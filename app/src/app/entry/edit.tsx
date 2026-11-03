import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { Belly } from '@/components/Belly';
import { Button } from '@/components/Button';
import { DoseFields, isOtherDose } from '@/components/DoseFields';
import { MealTimeSheet, pickTimeAndroid } from '@/components/MealTimeSheet';
import { NameField } from '@/components/NameField';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { TimePill } from '@/components/TimePill';
import { useToast } from '@/components/Toast';
import { TopBarButton } from '@/components/TopBar';
import { VerdictPicker } from '@/components/VerdictPicker';
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
import {
  isFoodSaved,
  removeSavedFood,
  saveFoodFromLog,
  savedFoodIdByName,
} from '@/db/repositories/savedFoods';
import type { MedicationLog } from '@/db/schema';
import { bellyMoodFor } from '@/lib/belly';
import { loadEntry } from '@/lib/entry';
import { logger } from '@/lib/logger';
import { earliestMealTime, formatMealTime } from '@/lib/mealTime';
import { medicationTypeLabel } from '@/lib/timeline';
import { effectiveVerdict } from '@/lib/verdict';
import { radius, space, typography, useColors } from '@/theme';
import type { AppVerdict } from '@/types/analysis';

const MAX_NOTE = 500;
const SAVE_FAILED = "We couldn't save that. Please try again.";

/**
 * Edit entry (Figma 15a meal, 15b dose), for something already in History. A meal is laid out like its entry
 * page: the editable name, time, Bellie, a verdict dropdown and a note, with the heart top right. A dose is the
 * dose details (Dose and Note). Changed with Save changes and left alone with the back arrow. Symptom entries
 * have their own editor and never come here.
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
  const initialVerdict = log.analysis ? effectiveVerdict(log.analysis) : null;
  const time = useTimePick(new Date(log.loggedAt));
  const [name, setName] = useState(log.mealName);
  const [verdict, setVerdict] = useState<AppVerdict | null>(initialVerdict);
  const [note, setNote] = useState(log.notes ?? '');
  // The heart is held here and applied with Save changes. A favorite is matched by name and the name can change, so
  // it is only acted on when the heart was touched, and turning it off removes the favorite of the name the meal had.
  const [initialFavorite] = useState(() => isFoodSaved(db, log.mealName));
  const [favorite, setFavorite] = useState(initialFavorite);
  // A ref, not state, so a quick second tap can't start a second save before the re-render.
  const saving = useRef(false);

  const trimmedName = name.trim();
  const save = () => {
    if (saving.current || !trimmedName) return;
    saving.current = true;
    const edit: FoodLogEdit = { name: trimmedName };
    if (time.at.getTime() !== new Date(log.loggedAt).getTime()) edit.loggedAt = time.at.toISOString();
    if (verdict && verdict !== initialVerdict) edit.verdict = verdict;
    try {
      updateFoodLog(db, log.id, edit);
      // The factors on the meal are no longer edited here, so they are written back as they are.
      saveMealDetails(db, log.id, { loggedAt: edit.loggedAt, tags: listMealTags(db, log.id), notes: note });
      if (favorite !== initialFavorite) {
        if (favorite) {
          // Under its new name, unless that name is already a favorite.
          if (savedFoodIdByName(db, trimmedName) === null) saveFoodFromLog(db, log.id);
        } else {
          const savedId = savedFoodIdByName(db, log.mealName);
          if (savedId !== null) removeSavedFood(db, savedId);
        }
      }
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
        {/* Like the entry page: no title, the heart top right. */}
        <BackHeader
          right={
            <TopBarButton
              icon={Heart}
              active={favorite}
              label={favorite ? 'Remove from favorite foods' : 'Add to favorite foods'}
              onPress={() => setFavorite((current) => !current)}
            />
          }
        />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.mealContent}>
          <View style={styles.stretch}>
            <NameField
              centered
              label="Meal name"
              value={name}
              onChangeText={setName}
              maxLength={MAX_MEAL_NAME}
              placeholder="Name this meal"
            />
          </View>
          <TimePill label={time.label} onPress={time.open} />
          {verdict && (
            <>
              <Belly mood={bellyMoodFor(verdict)} size={120} />
              <VerdictPicker value={verdict} onChange={setVerdict} />
            </>
          )}
          <View style={[styles.stretch, styles.noteBlock]}>
            <AppText variant="section">Note</AppText>
            <TextField
              label="Note"
              hideLabel
              multiline
              minHeight={96}
              value={note}
              onChangeText={setNote}
              placeholder="Add a note (optional)"
              maxLength={MAX_NOTE}
            />
          </View>
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
  // The meal page is one centred column, like the entry page it came from.
  mealContent: { gap: space.s3, alignItems: 'center', paddingBottom: space.s3 },
  stretch: { alignSelf: 'stretch' },
  noteBlock: { gap: space.s1_5 },
  footer: { paddingTop: space.s2 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeBadge: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill },
  typeBadgeText: typography.label,
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { textAlign: 'center' },
});
