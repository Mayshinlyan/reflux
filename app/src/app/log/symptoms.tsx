import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { MealTimeSheet, pickTimeAndroid } from '@/components/MealTimeSheet';
import { Screen } from '@/components/Screen';
import { SwipeNav } from '@/components/SwipeNav';
import { SymptomChip } from '@/components/SymptomChip';
import { TagChip } from '@/components/TagChip';
import { TextField } from '@/components/TextField';
import { TimePill } from '@/components/TimePill';
import { TimelineItem } from '@/components/TimelineItem';
import { useToast } from '@/components/Toast';
import { VerdictBadge } from '@/components/VerdictBadge';
import { orderedZones } from '@/constants/bodyZones';
import { LIFESTYLE_TAGS, type LifestyleTagKey } from '@/constants/lifestyleTags';
import { SYMPTOM_ITEMS, type SymptomKey } from '@/constants/symptomItems';
import { useDb } from '@/db/DatabaseProvider';
import { getFoodLog, listDiaryFoodLogs, type StoredFoodLog } from '@/db/repositories/food';
import { getSetting } from '@/db/repositories/settings';
import { createSymptomLog, getSymptomLog, updateSymptomLog } from '@/db/repositories/symptoms';
import { playChing } from '@/lib/ching';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { symptomsSwipe } from '@/lib/logSwipe';
import { dayToLoggedAt, formatClockTime, formatMealTime } from '@/lib/mealTime';
import { currentTimeZone } from '@/lib/time';
import { space } from '@/theme';

const MAX_NOTE_LENGTH = 1000;
/** A meal this recent before the symptoms is offered as the one they followed. */
const LINK_WINDOW_MS = 3 * 60 * 60 * 1000;

/** The area's symptoms with the ones the user usually feels first; each group keeps its own order. */
const usualFirst = (symptoms: readonly SymptomKey[], usual: readonly SymptomKey[]) => [
  ...symptoms.filter((key) => usual.includes(key)),
  ...symptoms.filter((key) => !usual.includes(key)),
];

const symptomLabel = (key: SymptomKey) => SYMPTOM_ITEMS.find((item) => item.key === key)?.label ?? key;

/** "Heartburn", "Heartburn and burping", "Heartburn, burping and 2 more". */
export function symptomsTitle(labels: string[]): string {
  if (labels.length === 0) return 'Symptoms';
  const lower = (label: string) => label.charAt(0).toLowerCase() + label.slice(1);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${lower(labels[1])}`;
  const more = labels.length - 2;
  return `${labels[0]}, ${lower(labels[1])} and ${more} more`;
}

/**
 * Symptom log in two steps: (1) tap what applies, grouped by body area, (2) details: when, what might have
 * contributed, the meal it followed and a note. With `?id=`, edits that entry.
 */
export default function LogSymptomsScreen() {
  const db = useDb();
  // Read once per visit: settings change on other screens, never while logging.
  const usual = useMemo(() => getSetting(db, 'usualSymptoms'), [db]);
  const conditions = useMemo(() => getSetting(db, 'conditions'), [db]);
  const toast = useToast();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ id?: string; afterFood?: string; date?: string }>();
  const editingId = params.id ? Number(params.id) : undefined;

  const existing = useMemo(() => {
    if (editingId === undefined || !Number.isInteger(editingId)) return undefined;
    try {
      return getSymptomLog(db, editingId);
    } catch (error) {
      // Treated like a missing entry: the screen explains it instead of crashing.
      logger.error('getSymptomLog', error);
      return undefined;
    }
  }, [db, editingId]);

  // Set when opened with ?afterFood=: these symptoms followed that meal.
  const afterMeal = useMemo(() => {
    const id = params.afterFood ? Number(params.afterFood) : NaN;
    if (editingId !== undefined || !Number.isInteger(id)) return undefined;
    try {
      return getFoodLog(db, id);
    } catch (error) {
      // The symptoms can still be logged, just without the link.
      logger.error('getFoodLog', error);
      return undefined;
    }
  }, [db, params.afterFood, editingId]);

  const [selected, setSelected] = useState<Set<SymptomKey>>(() => new Set(existing?.items.map((i) => i.key)));
  const [tags, setTags] = useState<Set<LifestyleTagKey>>(() => new Set(existing?.tags ?? []));
  const [note, setNote] = useState(existing?.notes ?? '');
  /** When it started. Null means "now, as of saving"; a week-strip day starts at noon of that day. */
  const [at, setAt] = useState<Date | null>(() => {
    if (existing) return new Date(existing.loggedAt);
    return params.date ? dayToLoggedAt(params.date, new Date()) : null;
  });
  const [timeOpen, setTimeOpen] = useState(false);
  /** The meal the user unlinked, so a different meal (after a time change) starts linked again. */
  const [unlinkedId, setUnlinkedId] = useState<number | null>(null);
  const [step, setStep] = useState(1);
  const scroll = useRef<ScrollView>(null);

  const goBack = useCallback(() => {
    if (step > 1) setStep(step - 1);
    else router.back();
  }, [step]);

  // Back walks to the first step before leaving, so a half-finished log isn't dropped by accident.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (step === 1) return false;
        goBack();
        return true;
      });
      return () => subscription.remove();
    }, [step, goBack]),
  );
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: step === 1 });
  }, [navigation, step]);

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  // Keep the canonical symptom order rather than tap order.
  const picked = useMemo(() => SYMPTOM_ITEMS.filter((item) => selected.has(item.key)), [selected]);

  // The meal these symptoms followed: the one named in the link, else the latest one just before them.
  const [openedAt] = useState(() => Date.now());
  const atTime = at?.getTime() ?? null;
  const candidate = useMemo<StoredFoodLog | undefined>(() => {
    if (editingId !== undefined) return undefined;
    if (afterMeal) return afterMeal;
    const end = atTime ?? openedAt;
    try {
      const meals = listDiaryFoodLogs(db, {
        from: new Date(end - LINK_WINDOW_MS).toISOString(),
        to: new Date(end + 1).toISOString(),
      });
      return meals[meals.length - 1];
    } catch (error) {
      logger.error('listDiaryFoodLogs', error);
      return undefined;
    }
  }, [db, editingId, afterMeal, atTime, openedAt]);
  const unlinked = candidate !== undefined && candidate.id === unlinkedId;
  const linked = candidate && !unlinked ? candidate : undefined;

  const toggleSymptom = (key: SymptomKey) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  };

  const toggleTag = (key: LifestyleTagKey) =>
    setTags((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const pickTime = () => {
    if (Platform.OS === 'android') pickTimeAndroid(at ?? new Date(), setAt);
    else setTimeOpen(true);
  };

  const save = () => {
    // An entry being edited keeps its time (and time zone) unless the time pill was used.
    const timeChanged = at !== null && !(existing && at.getTime() === new Date(existing.loggedAt).getTime());
    const input = {
      items: picked.map((item) => ({ key: item.key })),
      tags: [...tags],
      notes: note,
      foodLogId: linked?.id,
      ...(timeChanged && at ? { loggedAt: at.toISOString(), tz: currentTimeZone() } : {}),
    };
    try {
      if (editingId !== undefined) updateSymptomLog(db, editingId, input);
      else createSymptomLog(db, input);
    } catch (error) {
      logger.error(editingId !== undefined ? 'updateSymptomLog' : 'createSymptomLog', error);
      Alert.alert("Couldn't save", friendlyMessages.INTERNAL);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (editingId === undefined) playChing();
    toast(editingId !== undefined ? 'Entry updated' : 'Symptoms logged');
    router.back();
  };

  if (editingId !== undefined && !existing) {
    return (
      <Screen>
        <BackHeader />
        <AppText color="inkSoft">This entry no longer exists.</AppText>
      </Screen>
    );
  }

  // Swiping between log screens is only for a fresh, untouched log, so it can't drop a half-finished one.
  const pristine = editingId === undefined && step === 1 && selected.size === 0;
  const now = new Date();

  return (
    <SwipeNav {...symptomsSwipe} enabled={pristine}>
      <Screen style={styles.screen}>
        <BackHeader onBack={goBack} />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {step === 1 ? (
              <>
                <AppText variant="display" accessibilityRole="header">
                  What are you feeling?
                </AppText>
                <AppText color="inkSoft" style={styles.subtitle}>
                  Tap everything that applies.
                </AppText>
                {orderedZones(conditions).map((z) => (
                  <View key={z.key} style={styles.section}>
                    <AppText variant="section">{z.label}</AppText>
                    <View style={styles.chips}>
                      {usualFirst(z.symptoms, usual).map((key) => (
                        <SymptomChip
                          key={key}
                          label={symptomLabel(key)}
                          selected={selected.has(key)}
                          onToggle={() => toggleSymptom(key)}
                        />
                      ))}
                    </View>
                  </View>
                ))}
              </>
            ) : (
              <>
                <AppText variant="display" accessibilityRole="header">
                  {symptomsTitle(picked.map((item) => item.label))}
                </AppText>
                <View style={styles.timeRow}>
                  <TimePill label={formatMealTime(at, now)} onPress={pickTime} />
                </View>
                <View style={styles.section}>
                  <AppText variant="section">What might have contributed?</AppText>
                  <View style={styles.chips}>
                    {LIFESTYLE_TAGS.map((tag) => (
                      <TagChip
                        key={tag.key}
                        label={tag.label}
                        selected={tags.has(tag.key)}
                        onPress={() => toggleTag(tag.key)}
                      />
                    ))}
                  </View>
                </View>
                {candidate && (
                  <View style={styles.section}>
                    <AppText variant="section">Linked meal</AppText>
                    <View style={unlinked ? styles.dimmed : undefined}>
                      <TimelineItem
                        kind="food"
                        title={candidate.mealName}
                        time={formatClockTime(new Date(candidate.loggedAt))}
                        onPress={() => setUnlinkedId(unlinked ? null : candidate.id)}
                        side={candidate.overallVerdict && <VerdictBadge verdict={candidate.overallVerdict} />}
                      />
                    </View>
                    <AppText variant="caption" color="inkSoft">
                      {unlinked ? 'Not linked. Tap to link.' : 'Tap to unlink.'}
                    </AppText>
                  </View>
                )}
                <View style={styles.section}>
                  <AppText variant="section">Note</AppText>
                  <TextField
                    label="Note"
                    hideLabel
                    value={note}
                    onChangeText={setNote}
                    placeholder="How did it feel?"
                    maxLength={MAX_NOTE_LENGTH}
                    multiline
                  />
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {step === 1 ? (
              <Button
                label="Next"
                onPress={() => setStep(2)}
                disabled={selected.size === 0}
                accessibilityHint={selected.size === 0 ? 'Choose at least one symptom first' : undefined}
              />
            ) : (
              <Button label={editingId !== undefined ? 'Save changes' : 'Save'} onPress={save} />
            )}
          </View>
        </KeyboardAvoidingView>

        <MealTimeSheet
          visible={timeOpen}
          question="When did this start?"
          confirmLabel="Set time"
          onConfirm={(picked_) => {
            setTimeOpen(false);
            setAt(picked_);
          }}
          onClose={() => setTimeOpen(false)}
        />
      </Screen>
    </SwipeNav>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  flex: { flex: 1 },
  content: { paddingBottom: space.s3, flexGrow: 1, gap: space.s4 },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: -space.s2, marginBottom: space.s1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1 },
  section: { gap: 12 },
  timeRow: { flexDirection: 'row' },
  dimmed: { opacity: 0.45 },
  footer: { paddingTop: space.s2 },
});
