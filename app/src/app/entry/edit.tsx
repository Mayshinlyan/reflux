import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CheckboxRow } from '@/components/CheckboxRow';
import { MEAL_SYMPTOM_KEYS } from '@/components/food/FoodDetails';
import { MealTimeSheet, pickTimeAndroid } from '@/components/MealTimeSheet';
import { PortionSelect } from '@/components/PortionSelect';
import { Screen } from '@/components/Screen';
import { SymptomChip } from '@/components/SymptomChip';
import { TagChip } from '@/components/TagChip';
import { TextField } from '@/components/TextField';
import { TimePill } from '@/components/TimePill';
import { BackHeader } from '@/components/BackHeader';
import { useToast } from '@/components/Toast';
import { VerdictBadge } from '@/components/VerdictBadge';
import { LIFESTYLE_TAGS, type LifestyleTagKey } from '@/constants/lifestyleTags';
import { SYMPTOM_ITEMS, type SymptomKey } from '@/constants/symptomItems';
import { analysisConditions } from '@/constants/conditions';
import { useDb } from '@/db/DatabaseProvider';
import {
  type FoodLogEdit,
  listMealTags,
  saveMealDetails,
  type StoredFoodLog,
  updateFoodLog,
} from '@/db/repositories/food';
import { updateMedicationLogTime } from '@/db/repositories/medications';
import { isFoodSaved, saveFoodFromLog } from '@/db/repositories/savedFoods';
import { listSymptomLogsForMeal, setMealSymptoms } from '@/db/repositories/symptoms';
import type { MedicationLog } from '@/db/schema';
import { AppError } from '@/lib/errors';
import { loadEntry } from '@/lib/entry';
import { logger } from '@/lib/logger';
import { earliestMealTime, formatMealTime } from '@/lib/mealTime';
import { effectiveVerdict } from '@/lib/verdict';
import { getSetting } from '@/db/repositories/settings';
import { analyzeFood } from '@/services/relayClient';
import { space } from '@/theme';
import type { Portion } from '@/types/analysis';

const MAX_NOTE = 500;
const SAVE_FAILED = "We couldn't save that. Please try again.";

const toggled = <T,>(set: Set<T>, value: T) => {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
};

/** False once unmounted, so a re-check that finishes after the screen closed doesn't touch state. */
function useAlive() {
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  return alive;
}

/**
 * Edit entry (Figma 04d meal, 04g dose): the meal or dose in a full screen, changed with Save changes and
 * left alone with the back arrow. Symptom entries have their own editor and never come here.
 */
export default function EditEntryScreen() {
  const db = useDb();
  const params = useLocalSearchParams<{ kind?: string; id?: string }>();
  const entry = useMemo(() => {
    try {
      return loadEntry(db, params.kind, params.id);
    } catch (error) {
      logger.error('loadEntry', error);
      return undefined;
    }
  }, [db, params.kind, params.id]);

  if (entry?.kind === 'food') return <MealEdit log={entry.log} />;
  if (entry?.kind === 'medication') return <DoseEdit log={entry.log} />;
  return (
    <Screen>
      <BackHeader title="Edit entry" />
      <View style={styles.missing}>
        <AppText color="inkSoft" style={styles.missingText}>
          This entry can&apos;t be edited here.
        </AppText>
      </View>
    </Screen>
  );
}

/** The time pill and the sheet (iPhone) or system dialogs (Android) behind it. */
function useTimePick(initial: Date) {
  const [at, setAt] = useState(initial);
  const [picking, setPicking] = useState(false);
  // The earliest day is the past week, or the entry's own day when it is older.
  const [original] = useState(initial);
  const earliest = earliestMealTime(new Date());
  const minimum = original < earliest ? original : earliest;
  const open = () => {
    if (Platform.OS === 'android') pickTimeAndroid(at, setAt, minimum);
    else setPicking(true);
  };
  return { at, setAt, picking, setPicking, minimum, open, label: formatMealTime(at, new Date()) };
}

function TimeSheet({ time, question }: { time: ReturnType<typeof useTimePick>; question: string }) {
  return (
    <MealTimeSheet
      visible={time.picking}
      question={question}
      confirmLabel="Set time"
      initial={time.at}
      minimum={time.minimum}
      onConfirm={(picked) => {
        time.setPicking(false);
        // Left alone means keep the time as it is.
        if (picked) time.setAt(picked);
      }}
      onClose={() => time.setPicking(false)}
    />
  );
}

function Footer({ children }: { children: ReactNode }) {
  return <View style={styles.footer}>{children}</View>;
}

function MealEdit({ log }: { log: StoredFoodLog }) {
  const db = useDb();
  const toast = useToast();
  const alive = useAlive();
  const originalPortion: Portion = log.portion ?? 'regular';
  const originalVerdict = log.analysis ? effectiveVerdict(log.analysis) : null;
  const alreadySaved = useMemo(() => isFoodSaved(db, log.mealName), [db, log.mealName]);

  const time = useTimePick(new Date(log.loggedAt));
  const [portion, setPortion] = useState<Portion>(originalPortion);
  const [tags, setTags] = useState<Set<LifestyleTagKey>>(() => new Set(listMealTags(db, log.id)));
  const [symptoms, setSymptoms] = useState<Set<SymptomKey>>(
    () =>
      new Set(
        listSymptomLogsForMeal(db, log.id)
          .flatMap((after) => after.items.map((item) => item.key))
          .filter((key) => MEAL_SYMPTOM_KEYS.includes(key)),
      ),
  );
  const [note, setNote] = useState(log.notes ?? '');
  const [keep, setKeep] = useState(false);
  const [checking, setChecking] = useState(false);
  // A ref, not state, so a quick second tap can't start a second save before the re-render.
  const saving = useRef(false);

  // A new portion re-checks the meal on Save, so the verdict matches it. A meal saved without a verdict has
  // nothing to re-check, so its portion is just noted.
  const recheck = portion !== originalPortion && log.analysis !== null;
  const symptomChoices = MEAL_SYMPTOM_KEYS.map(
    (key) => SYMPTOM_ITEMS.find((item) => item.key === key) ?? { key, label: key },
  );

  const save = async () => {
    if (saving.current) return;
    saving.current = true;
    const loggedAtChanged = time.at.getTime() !== new Date(log.loggedAt).getTime();
    const edit: FoodLogEdit = { name: log.mealName, portion };
    if (loggedAtChanged) edit.loggedAt = time.at.toISOString();
    if (recheck) {
      setChecking(true);
      try {
        const portionExtra = {
          ...(portion !== 'regular' ? { portion } : {}),
          ...analysisConditions(getSetting(db, 'conditions')),
        };
        const { meta, ...analysis } = await analyzeFood(
          log.photoUri
            ? { photo: { uri: log.photoUri, mimeType: 'image/jpeg' }, ...portionExtra }
            : { text: log.inputText ?? log.mealName, ...portionExtra },
        );
        if (!alive.current) return;
        edit.check = { analysis, meta };
      } catch (caught) {
        if (!alive.current) return;
        const error = caught instanceof AppError ? caught : new AppError('INTERNAL');
        logger.error('analyzeFood', error);
        // The edits stay so the user can try again.
        toast(error.friendlyMessage);
        saving.current = false;
        setChecking(false);
        return;
      }
    }
    // A verdict the user set earlier is their own judgement, so it is kept over a re-check's new verdict.
    const earlierOverride = log.analysis?.overall.userVerdict;
    if (edit.check && earlierOverride) edit.verdict = earlierOverride;
    try {
      updateFoodLog(db, log.id, edit);
      saveMealDetails(db, log.id, {
        loggedAt: edit.loggedAt,
        portion,
        tags: [...tags],
        notes: note,
      });
      setMealSymptoms(db, log.id, [...symptoms], MEAL_SYMPTOM_KEYS, time.at.toISOString());
      if (keep) saveFoodFromLog(db, log.id);
    } catch (error) {
      logger.error('saveEntry', error);
      toast(SAVE_FAILED);
      saving.current = false;
      if (alive.current) setChecking(false);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast(recheck ? 'Changes saved. Verdict updated for the new portion.' : 'Changes saved');
    router.back();
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <BackHeader title="Edit entry" />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          <View style={styles.meal}>
            {originalVerdict && <VerdictBadge verdict={originalVerdict} />}
            <AppText variant="hero" accessibilityRole="header">
              {log.mealName}
            </AppText>
            <TimePill label={time.label} onPress={time.open} />
          </View>
          <View style={styles.section}>
            <AppText variant="section">Portion</AppText>
            <PortionSelect hideLabel value={portion} onChange={setPortion} />
          </View>
          <View style={styles.section}>
            <AppText variant="section">Anything else?</AppText>
            <View style={styles.chips}>
              {LIFESTYLE_TAGS.map((tag) => (
                <TagChip
                  key={tag.key}
                  label={tag.label}
                  selected={tags.has(tag.key)}
                  onPress={() => setTags((current) => toggled(current, tag.key))}
                />
              ))}
            </View>
          </View>
          <View style={styles.section}>
            <AppText variant="section">Any symptoms? (optional)</AppText>
            <View style={styles.chips}>
              {symptomChoices.map((symptom) => (
                <SymptomChip
                  key={symptom.key}
                  label={symptom.label}
                  selected={symptoms.has(symptom.key)}
                  onToggle={() => setSymptoms((current) => toggled(current, symptom.key))}
                />
              ))}
            </View>
          </View>
          <View style={styles.section}>
            <AppText variant="section">Note</AppText>
            <TextField
              label="Note"
              hideLabel
              value={note}
              onChangeText={setNote}
              placeholder="How did it feel?"
              maxLength={MAX_NOTE}
              returnKeyType="done"
            />
          </View>
          {!alreadySaved && (
            <CheckboxRow label="Also save to My foods" checked={keep} onToggle={() => setKeep((on) => !on)} />
          )}
        </ScrollView>
        <Footer>
          <Button
            label={checking ? 'Checking…' : 'Save changes'}
            onPress={() => void save()}
            disabled={checking}
          />
        </Footer>
      </KeyboardAvoidingView>
      <TimeSheet time={time} question="When did you eat this?" />
    </Screen>
  );
}

function DoseEdit({ log }: { log: MedicationLog }) {
  const db = useDb();
  const toast = useToast();
  const time = useTimePick(new Date(log.takenAt));

  const save = () => {
    try {
      if (time.at.getTime() !== new Date(log.takenAt).getTime()) {
        updateMedicationLogTime(db, log.id, time.at.toISOString());
      }
    } catch (error) {
      logger.error('updateMedicationLog', error);
      toast(SAVE_FAILED);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast('Changes saved');
    router.back();
  };

  return (
    <Screen>
      <BackHeader title="Edit entry" />
      <View style={[styles.flex, styles.meal]}>
        <AppText variant="hero" accessibilityRole="header">
          {log.doseText ? `${log.name} ${log.doseText}` : log.name}
        </AppText>
        <TimePill label={time.label} onPress={time.open} />
      </View>
      <Footer>
        <Button label="Save changes" onPress={save} />
      </Footer>
      <TimeSheet time={time} question="When did you take this?" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: space.s4, paddingBottom: space.s3 },
  meal: { gap: 16 },
  section: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1 },
  footer: { paddingTop: space.s2 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { textAlign: 'center' },
});
