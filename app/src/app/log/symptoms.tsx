import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
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
import { InlineAddChip } from '@/components/InlineAddChip';
import { MealTimeSheet, pickTimeAndroid } from '@/components/MealTimeSheet';
import { Screen } from '@/components/Screen';
import { SymptomChip } from '@/components/SymptomChip';
import { TagChip } from '@/components/TagChip';
import { TextField } from '@/components/TextField';
import { TimePill } from '@/components/TimePill';
import { TimelineItem } from '@/components/TimelineItem';
import { useToast } from '@/components/Toast';
import { VerdictBadge } from '@/components/VerdictBadge';
import { BODY_ZONES, OTHER_AREA_LABEL, type SymptomArea } from '@/constants/bodyZones';
import {
  type CustomTagKey,
  isCustomTag,
  LIFESTYLE_TAGS,
  type LoggedTagKey,
  tagKeyFromText,
} from '@/constants/lifestyleTags';
import {
  CUSTOM_PREFIX,
  type CustomSymptomKey,
  customSymptomLabel,
  isCustomSymptom,
  type LoggedSymptomKey,
  SYMPTOM_ITEMS,
  type SymptomKey,
  symptomKeyFromText,
} from '@/constants/symptomItems';
import { useDb } from '@/db/DatabaseProvider';
import { getFoodLog, listDiaryFoodLogs, type StoredFoodLog } from '@/db/repositories/food';
import { createSavedSymptom, listSavedSymptoms } from '@/db/repositories/savedSymptoms';
import type { SavedSymptom } from '@/db/schema';
import { getSetting } from '@/db/repositories/settings';
import { createSymptomLog, getSymptomLog, updateSymptomLog } from '@/db/repositories/symptoms';
import { playChing } from '@/lib/ching';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { dayToLoggedAt, formatClockTime, formatMealTime } from '@/lib/mealTime';
import { currentTimeZone } from '@/lib/time';
import { symptomLabel, tagLabel } from '@/lib/timeline';
import { cancelCheckIn } from '@/services/reminders';
import { space, typography } from '@/theme';

const MAX_NOTE_LENGTH = 1000;
/** A meal this recent before the symptoms is offered as the one they followed. */
const LINK_WINDOW_MS = 3 * 60 * 60 * 1000;

/** The area's symptoms with the ones the user usually feels first; each group keeps its own order. */
const usualFirst = (symptoms: readonly SymptomKey[], usual: readonly SymptomKey[]) => [
  ...symptoms.filter((key) => usual.includes(key)),
  ...symptoms.filter((key) => !usual.includes(key)),
];

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
 * "How I feel" (Figma 03k, 24c): (1) tap what applies, grouped by body area, each group starting with a "+" chip to
 * add your own. "Log" waits for a symptom and saves at once (time = now), with a "Symptoms logged · Add details"
 * toast; (2) the optional details (when, a note, what's going on, the meal it followed) are that toast's page, or
 * the way in for lifestyle on its own ("No symptoms"), which "Done" saves. With `?id=`, edits that entry; with
 * `?details=1` as well, it opens on the details page.
 */
export default function LogSymptomsScreen() {
  const db = useDb();
  // Read once per visit: settings change on other screens, never while logging.
  const usual = useMemo(() => getSetting(db, 'usualSymptoms'), [db]);
  const toast = useToast();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ id?: string; afterFood?: string; date?: string; details?: string }>();
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

  // The details page of an entry just logged ("Add details" on its toast): it can still link a recent meal.
  const detailsMode = existing !== undefined && params.details === '1';

  // Set when opened with ?afterFood=, or when the entry being detailed already follows a meal: these symptoms
  // followed that meal.
  const afterMeal = useMemo(() => {
    const id = existing ? (existing.foodLogId ?? NaN) : params.afterFood ? Number(params.afterFood) : NaN;
    if ((editingId !== undefined && !detailsMode) || !Number.isInteger(id)) return undefined;
    try {
      return getFoodLog(db, id);
    } catch (error) {
      // The symptoms can still be logged, just without the link.
      logger.error('getFoodLog', error);
      return undefined;
    }
  }, [db, params.afterFood, editingId, existing, detailsMode]);

  const [selected, setSelected] = useState<Set<LoggedSymptomKey>>(
    () => new Set(existing?.items.map((i) => i.key)),
  );
  // What the user typed with a "+" chip before, as the chips offered in each group.
  const [saved, setSaved] = useState<SavedSymptom[]>(() => {
    try {
      return listSavedSymptoms(db);
    } catch (error) {
      logger.error('listSavedSymptoms', error);
      return [];
    }
  });
  // Typed ones this screen has seen that may not be saved (on the entry being edited, or a save that failed),
  // so tapping one off leaves a chip to tap it back on. Symptoms remember the group they were added in.
  const [seenOwn, setSeenOwn] = useState<CustomSymptomKey[]>(() =>
    (existing?.items ?? []).map((item) => item.key).filter(isCustomSymptom),
  );
  const [addedZone, setAddedZone] = useState<Record<string, SymptomArea>>({});
  const [seenTags, setSeenTags] = useState<CustomTagKey[]>(() => (existing?.tags ?? []).filter(isCustomTag));
  const [tags, setTags] = useState<Set<LoggedTagKey>>(() => new Set(existing?.tags ?? []));
  const [note, setNote] = useState(existing?.notes ?? '');
  /** When it started. Null means "now, as of saving"; a week-strip day starts at noon of that day. */
  const [at, setAt] = useState<Date | null>(() => {
    if (existing) return new Date(existing.loggedAt);
    return params.date ? dayToLoggedAt(params.date, new Date()) : null;
  });
  const [timeOpen, setTimeOpen] = useState(false);
  /** The meal the user linked. None by default, so a different meal (after a time change) starts unlinked; a meal that opened this screen stays linked. */
  const [linkedId, setLinkedId] = useState<number | null>(afterMeal?.id ?? null);
  const [step, setStep] = useState(() => (existing && params.details === '1' ? 2 : 1));
  const scroll = useRef<ScrollViewInstance>(null);

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
  // The edge swipe leaves at once, so it is only on while there is nothing to lose: nothing picked or typed yet,
  // or an edit (the entry itself is untouched until it is saved).
  const hasInput = selected.size > 0 || tags.size > 0 || note.trim().length > 0;
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: step === 1 && (editingId !== undefined || !hasInput) });
  }, [navigation, step, editingId, hasInput]);

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  // Keep the canonical symptom order rather than tap order.
  const picked = useMemo(
    () => [
      ...SYMPTOM_ITEMS.filter((item) => selected.has(item.key)).map((item) => ({
        key: item.key as LoggedSymptomKey,
        label: item.label,
      })),
      ...[...selected].filter(isCustomSymptom).map((key) => ({ key, label: customSymptomLabel(key) })),
    ],
    [selected],
  );

  // The typed symptoms of each group: the saved ones, then any seen on this screen that are not saved. Each
  // sits in the group it was added in; one with no known group (saved before groups existed, or on an old
  // entry) goes under Other.
  const ownByZone = useMemo(() => {
    const zoneNamed = (zone: string | null | undefined): SymptomArea | undefined =>
      zone === 'other' ? 'other' : BODY_ZONES.find((z) => z.key === zone)?.key;
    const zones = new Map<CustomSymptomKey, SymptomArea>();
    for (const row of saved) {
      if (row.kind === 'symptom') {
        zones.set(`${CUSTOM_PREFIX}${row.name}`, zoneNamed(row.zone) ?? 'other');
      }
    }
    for (const key of seenOwn) {
      const zone = zoneNamed(addedZone[key]) ?? zones.get(key) ?? 'other';
      zones.set(key, zone);
    }
    const groups = new Map<SymptomArea, CustomSymptomKey[]>();
    for (const [key, zone] of zones) groups.set(zone, [...(groups.get(zone) ?? []), key]);
    return groups;
  }, [saved, seenOwn, addedZone]);
  const ownTagKeys = useMemo(() => {
    const keys = saved
      .filter((row) => row.kind === 'lifestyle')
      .map((row) => `${CUSTOM_PREFIX}${row.name}` as const);
    return [...keys, ...seenTags.filter((key) => !keys.includes(key))];
  }, [saved, seenTags]);

  // The meal these symptoms followed: the one named in the link, else the latest one just before them.
  const [openedAt] = useState(() => Date.now());
  const atTime = at?.getTime() ?? null;
  const candidate = useMemo<StoredFoodLog | undefined>(() => {
    if (editingId !== undefined && !detailsMode) return undefined;
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
  }, [db, editingId, detailsMode, afterMeal, atTime, openedAt]);
  const linked = candidate && candidate.id === linkedId ? candidate : undefined;

  const toggleSymptom = (key: LoggedSymptomKey) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  };

  const reloadSaved = () => {
    try {
      setSaved(listSavedSymptoms(db));
    } catch (error) {
      logger.error('listSavedSymptoms', error);
    }
  };

  /** Typed in a group's "+" chip: a built-in name picks that chip, anything else is saved to the group and picked. */
  const addOwnSymptom = (text: string, zone: SymptomArea) => {
    const key = symptomKeyFromText(text);
    if (!key) return;
    if (isCustomSymptom(key)) {
      try {
        createSavedSymptom(db, customSymptomLabel(key), 'symptom', zone);
        reloadSaved();
      } catch (error) {
        // It can still be logged; it just won't be offered as a chip next time.
        logger.error('createSavedSymptom', error);
      }
      setAddedZone((current) => ({ ...current, [key]: zone }));
      setSeenOwn((current) => (current.includes(key) ? current : [...current, key]));
    }
    Haptics.selectionAsync().catch(() => {});
    setSelected((current) => new Set(current).add(key));
  };

  /** Typed in the lifestyle "+" chip, the same way. */
  const addOwnTag = (text: string) => {
    const key = tagKeyFromText(text);
    if (!key) return;
    if (isCustomTag(key)) {
      try {
        createSavedSymptom(db, customSymptomLabel(key), 'lifestyle');
        reloadSaved();
      } catch (error) {
        logger.error('createSavedSymptom', error);
      }
      setSeenTags((current) => (current.includes(key) ? current : [...current, key]));
    }
    Haptics.selectionAsync().catch(() => {});
    setTags((current) => new Set(current).add(key));
  };

  const toggleTag = (key: LoggedTagKey) =>
    setTags((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  // Where each group starts, so opening its "+" field scrolls it clear of the keyboard.
  const sectionY = useRef<Record<string, number>>({});
  const reveal = (key: string) =>
    scroll.current?.scrollTo({ y: Math.max(0, (sectionY.current[key] ?? 0) - space.s2), animated: true });

  const pickTime = () => {
    if (Platform.OS === 'android') pickTimeAndroid(at ?? new Date(), setAt);
    else setTimeOpen(true);
  };

  // Something to save: a symptom, or a lifestyle factor on its own ("Just checking in").
  const canSave = selected.size > 0 || tags.size > 0;
  const saveHint = canSave ? undefined : 'Pick a symptom or something going on first';

  /** `quick`: "Log" on the first page, which saves now and leaves the details to the toast. */
  const save = (quick = false) => {
    // An entry being edited keeps its time (and time zone) unless the time pill was used.
    const timeChanged = at !== null && !(existing && at.getTime() === new Date(existing.loggedAt).getTime());
    const withSymptoms = picked.length > 0;
    const mealLink =
      editingId === undefined
        ? withSymptoms
          ? linked?.id
          : undefined
        : detailsMode
          ? withSymptoms
            ? (linked?.id ?? null)
            : null
          : undefined;
    const input = {
      items: picked.map((item) => ({ key: item.key })),
      tags: [...tags],
      notes: note,
      // The link to a meal is about symptoms that followed it, so a lifestyle-only check-in has none. Editing an
      // entry leaves the link alone, except on its details page, which can set or take it off.
      foodLogId: mealLink,
      ...(timeChanged && at ? { loggedAt: at.toISOString(), tz: currentTimeZone() } : {}),
    };
    let createdId: number | undefined;
    try {
      if (editingId !== undefined) updateSymptomLog(db, editingId, input);
      else createdId = createSymptomLog(db, input);
    } catch (error) {
      logger.error(editingId !== undefined ? 'updateSymptomLog' : 'createSymptomLog', error);
      Alert.alert("Couldn't save", friendlyMessages.INTERNAL);
      return;
    }
    // Checking in after a meal answers its reminder.
    if ((editingId === undefined || detailsMode) && linked) void cancelCheckIn(linked.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (editingId === undefined) playChing();
    if (quick && createdId !== undefined) {
      const id = createdId;
      toast('Symptoms logged', {
        action: {
          label: 'Add details',
          onPress: () => router.push({ pathname: '/log/symptoms', params: { id: String(id), details: '1' } }),
        },
      });
    } else {
      toast(editingId !== undefined ? 'Entry updated' : 'Logged');
    }
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

  const now = new Date();

  return (
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
                How do you feel?
              </AppText>
              <AppText color="inkSoft" style={styles.subtitle}>
                Tap everything that applies.
              </AppText>
              {BODY_ZONES.map((z) => (
                <View
                  key={z.key}
                  style={styles.section}
                  onLayout={(event) => {
                    sectionY.current[z.key] = event.nativeEvent.layout.y;
                  }}>
                  <AppText variant="section">{z.label}</AppText>
                  <View style={styles.chips}>
                    <InlineAddChip
                      label={`Add your own to ${z.label}`}
                      placeholder="e.g. Hiccups"
                      onAdd={(text) => addOwnSymptom(text, z.key)}
                      onOpen={() => reveal(z.key)}
                    />
                    {usualFirst(z.symptoms, usual).map((key) => (
                      <SymptomChip
                        key={key}
                        label={symptomLabel(key)}
                        selected={selected.has(key)}
                        onToggle={() => toggleSymptom(key)}
                      />
                    ))}
                    {(ownByZone.get(z.key) ?? []).map((key) => (
                      <SymptomChip
                        key={key}
                        label={customSymptomLabel(key)}
                        selected={selected.has(key)}
                        onToggle={() => toggleSymptom(key)}
                      />
                    ))}
                  </View>
                </View>
              ))}
              <View
                style={styles.section}
                onLayout={(event) => {
                  sectionY.current.other = event.nativeEvent.layout.y;
                }}>
                <AppText variant="section">{OTHER_AREA_LABEL}</AppText>
                <View style={styles.chips}>
                  <InlineAddChip
                    label={`Add your own to ${OTHER_AREA_LABEL}`}
                    placeholder="e.g. Hiccups"
                    onAdd={(text) => addOwnSymptom(text, 'other')}
                    onOpen={() => reveal('other')}
                  />
                  {(ownByZone.get('other') ?? []).map((key) => (
                    <SymptomChip
                      key={key}
                      label={customSymptomLabel(key)}
                      selected={selected.has(key)}
                      onToggle={() => toggleSymptom(key)}
                    />
                  ))}
                </View>
              </View>
            </>
          ) : (
            <>
              <AppText variant="display" accessibilityRole="header">
                {picked.length > 0 ? symptomsTitle(picked.map((item) => item.label)) : 'Just checking in'}
              </AppText>
              <AppText color="inkSoft" style={styles.subtitle}>
                Anything else? All optional.
              </AppText>
              <View style={styles.timeRow}>
                <TimePill label={formatMealTime(at, now)} onPress={pickTime} />
              </View>
              <TextField
                label="Note"
                hideLabel
                value={note}
                onChangeText={setNote}
                placeholder="Add a note (optional)"
                maxLength={MAX_NOTE_LENGTH}
                multiline
              />
              <View
                style={styles.section}
                onLayout={(event) => {
                  sectionY.current.tags = event.nativeEvent.layout.y;
                }}>
                <AppText variant="section">What&apos;s going on?</AppText>
                <View style={styles.chips}>
                  <InlineAddChip
                    label="Add your own to What's going on?"
                    placeholder="e.g. Skipped breakfast"
                    onAdd={addOwnTag}
                    onOpen={() => reveal('tags')}
                  />
                  {LIFESTYLE_TAGS.map((tag) => (
                    <TagChip
                      key={tag.key}
                      label={tag.label}
                      selected={tags.has(tag.key)}
                      onPress={() => toggleTag(tag.key)}
                    />
                  ))}
                  {ownTagKeys.map((key) => (
                    <TagChip
                      key={key}
                      label={tagLabel(key)}
                      selected={tags.has(key)}
                      onPress={() => toggleTag(key)}
                    />
                  ))}
                </View>
              </View>
              {candidate && picked.length > 0 && (
                <View style={styles.section}>
                  <AppText variant="section">Recent meal</AppText>
                  <View style={linked ? undefined : styles.dimmed}>
                    <TimelineItem
                      kind="food"
                      title={candidate.mealName}
                      time={formatClockTime(new Date(candidate.loggedAt))}
                      onPress={() => setLinkedId(linked ? null : candidate.id)}
                      side={candidate.overallVerdict && <VerdictBadge verdict={candidate.overallVerdict} />}
                    />
                  </View>
                  <AppText variant="caption" color="inkSoft">
                    {linked
                      ? 'Linked to these symptoms. Tap to unlink.'
                      : 'Tap to link it to these symptoms.'}
                  </AppText>
                </View>
              )}
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step === 1 ? (
            <>
              <Button
                label={editingId === undefined ? 'Log' : 'Next'}
                onPress={() => (editingId === undefined ? save(true) : setStep(2))}
                disabled={editingId === undefined && picked.length === 0}
                accessibilityHint={
                  editingId === undefined && picked.length === 0 ? 'Pick a symptom first' : undefined
                }
              />
              {editingId !== undefined ? (
                <Button
                  variant="quiet"
                  label="Save changes"
                  onPress={() => save()}
                  disabled={!canSave}
                  accessibilityHint={saveHint}
                />
              ) : picked.length === 0 ? (
                // Lifestyle-only logging: skip the symptoms and go to "what's going on".
                <Button variant="quiet" label="No symptoms" onPress={() => setStep(2)} />
              ) : null}
            </>
          ) : (
            <Button
              label={editingId !== undefined ? 'Save changes' : 'Done'}
              onPress={() => save()}
              disabled={!canSave}
              accessibilityHint={saveHint}
            />
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
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  flex: { flex: 1 },
  content: { paddingBottom: space.s3, flexGrow: 1, gap: space.s4 },
  subtitle: { ...typography.subtitle, marginTop: -space.s2, marginBottom: space.s1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1 },
  section: { gap: space.s1_5 },
  timeRow: { flexDirection: 'row' },
  dimmed: { opacity: 0.45 },
  footer: { paddingTop: space.s2, gap: space.s1 },
});
