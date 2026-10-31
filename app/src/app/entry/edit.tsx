import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { DoseFields, isOtherDose } from '@/components/DoseFields';
import { FoodDetails, MEAL_SYMPTOM_KEYS, type MealDetailsState } from '@/components/food/FoodDetails';
import { MealTimeSheet, pickTimeAndroid } from '@/components/MealTimeSheet';
import { Screen } from '@/components/Screen';
import { TimePill } from '@/components/TimePill';
import { useToast } from '@/components/Toast';
import { isCustomTag, type LoggedTagKey } from '@/constants/lifestyleTags';
import { isCustomSymptom, type LoggedSymptomKey } from '@/constants/symptomItems';
import { useDb } from '@/db/DatabaseProvider';
import {
  type FoodLogEdit,
  listMealTags,
  MAX_MEAL_NAME,
  saveMealDetails,
  type StoredFoodLog,
  updateFoodLog,
} from '@/db/repositories/food';
import { updateMedicationLog } from '@/db/repositories/medications';
import { isFoodSaved, saveFoodFromLog } from '@/db/repositories/savedFoods';
import { listSymptomLogsForMeal, setMealSymptoms } from '@/db/repositories/symptoms';
import type { MedicationLog } from '@/db/schema';
import { useSavedAdditions } from '@/hooks/useSavedAdditions';
import { loadEntry } from '@/lib/entry';
import { logger } from '@/lib/logger';
import { earliestMealTime, formatMealTime } from '@/lib/mealTime';
import { medicationTypeLabel } from '@/lib/timeline';
import { effectiveVerdict } from '@/lib/verdict';
import { radius, space, typography, useColors } from '@/theme';

const MAX_NOTE = 500;
const SAVE_FAILED = "We couldn't save that. Please try again.";

const unique = <T,>(items: T[]) => [...new Set(items)];

/**
 * Edit entry (Figma 15a meal, 15b dose): the same pages as logging, for something already in History. A meal
 * is the check-in layout (name editable, "+" chips, star); a dose is the dose details (Dose and Note). Changed
 * with Save changes and left alone with the back arrow. Symptom entries have their own editor and never come
 * here.
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
  const additions = useSavedAdditions();
  const alreadySaved = useMemo(() => isFoodSaved(db, log.mealName), [db, log.mealName]);
  // What is on the meal now, read once: the typed ones among it are offered as chips next to the saved ones.
  const [initial] = useState(() => ({
    tags: listMealTags(db, log.id),
    symptoms: listSymptomLogsForMeal(db, log.id)
      .flatMap((after) => after.items.map((item) => item.key))
      .filter(
        (key): key is LoggedSymptomKey =>
          MEAL_SYMPTOM_KEYS.some((meal) => meal === key) || isCustomSymptom(key),
      ),
  }));

  const time = useTimePick(new Date(log.loggedAt));
  const [name, setName] = useState(log.mealName);
  const [details, setDetails] = useState<MealDetailsState>({
    tags: new Set<LoggedTagKey>(initial.tags),
    symptoms: new Set<LoggedSymptomKey>(initial.symptoms),
    note: log.notes ?? '',
    keep: false,
  });
  const scroll = useRef<ScrollViewInstance>(null);
  // A ref, not state, so a quick second tap can't start a second save before the re-render.
  const saving = useRef(false);
  const verdict = log.analysis ? effectiveVerdict(log.analysis) : null;

  const ownTags = unique([...additions.ownTagKeys, ...initial.tags.filter(isCustomTag)]);
  const ownSymptoms = unique([...additions.ownSymptomKeys, ...initial.symptoms.filter(isCustomSymptom)]);
  /** Typed in a "+" chip: saved to My additions and picked on this meal. */
  const addTag = (text: string) => {
    const key = additions.addTag(text);
    if (!key) return;
    Haptics.selectionAsync().catch(() => {});
    setDetails((current) => ({ ...current, tags: new Set(current.tags).add(key) }));
  };
  const addSymptom = (text: string) => {
    const key = additions.addSymptom(text);
    if (!key) return;
    Haptics.selectionAsync().catch(() => {});
    setDetails((current) => ({ ...current, symptoms: new Set(current.symptoms).add(key) }));
  };

  const trimmedName = name.trim();
  const save = () => {
    if (saving.current || !trimmedName) return;
    saving.current = true;
    const edit: FoodLogEdit = { name: trimmedName };
    if (time.at.getTime() !== new Date(log.loggedAt).getTime()) edit.loggedAt = time.at.toISOString();
    try {
      updateFoodLog(db, log.id, edit);
      saveMealDetails(db, log.id, {
        loggedAt: edit.loggedAt,
        tags: [...details.tags],
        notes: details.note,
      });
      // Typed symptoms can be taken off too, not only the ones offered after a meal.
      const managed = unique([
        ...MEAL_SYMPTOM_KEYS,
        ...ownSymptoms,
        ...[...details.symptoms].filter(isCustomSymptom),
      ]);
      setMealSymptoms(db, log.id, [...details.symptoms], managed, time.at.toISOString());
      if (details.keep) saveFoodFromLog(db, log.id);
    } catch (error) {
      logger.error('saveEntry', error);
      toast(SAVE_FAILED);
      saving.current = false;
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast('Changes saved');
    router.back();
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <BackHeader title="Edit entry" />
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          <FoodDetails
            edit={{ verdict, onRename: setName, maxName: MAX_MEAL_NAME }}
            mealName={name}
            canFavorite={!alreadySaved}
            whenLabel={time.label}
            onPickTime={time.open}
            state={details}
            onChange={setDetails}
            maxNote={MAX_NOTE}
            ownTags={ownTags}
            ownSymptoms={ownSymptoms}
            onAddTag={addTag}
            onAddSymptom={addSymptom}
            onReveal={(y) => scroll.current?.scrollTo({ y: Math.max(0, y - space.s2), animated: true })}
          />
        </ScrollView>
        <Footer>
          <Button label="Save changes" onPress={save} disabled={!trimmedName} />
        </Footer>
      </KeyboardAvoidingView>
      <TimeSheet time={time} question="When did you eat this?" />
    </Screen>
  );
}

function DoseEdit({ log }: { log: MedicationLog }) {
  const db = useDb();
  const toast = useToast();
  const colors = useColors();
  const time = useTimePick(new Date(log.takenAt));
  const [dose, setDose] = useState(log.doseText ?? '');
  // A stored dose that isn't one of the chips starts on "Other", with the text in the field.
  const [custom, setCustom] = useState(() => isOtherDose(log.name, log.doseText ?? ''));
  const [note, setNote] = useState(log.notes ?? '');

  const save = () => {
    try {
      const changed = time.at.getTime() !== new Date(log.takenAt).getTime();
      updateMedicationLog(db, log.id, {
        takenAt: changed ? time.at.toISOString() : undefined,
        doseText: dose,
        notes: note,
      });
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <BackHeader title="Edit entry" />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          <AppText variant="display" accessibilityRole="header">
            {log.name}
          </AppText>
          <View style={styles.timeRow}>
            <TimePill label={time.label} onPress={time.open} />
            <View style={[styles.typeBadge, { backgroundColor: colors.surface }]}>
              <AppText style={styles.typeBadgeText}>{medicationTypeLabel(log.type)}</AppText>
            </View>
          </View>
          <DoseFields
            name={log.name}
            dose={dose}
            custom={custom}
            note={note}
            onDose={setDose}
            onCustom={setCustom}
            onNote={setNote}
          />
        </ScrollView>
        <Footer>
          <Button label="Save changes" onPress={save} />
        </Footer>
      </KeyboardAvoidingView>
      <TimeSheet time={time} question="When did you take this?" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: space.s4, paddingBottom: space.s3 },
  footer: { paddingTop: space.s2 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeBadge: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill },
  typeBadgeText: typography.label,
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { textAlign: 'center' },
});
