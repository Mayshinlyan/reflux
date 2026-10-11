import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { ChevronDown, ChevronUp, Pill } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { MealTimeSheet, pickTimeAndroid } from '@/components/MealTimeSheet';
import { Screen } from '@/components/Screen';
import { SwipeNav } from '@/components/SwipeNav';
import { TagChip } from '@/components/TagChip';
import { TextField } from '@/components/TextField';
import { TimePill } from '@/components/TimePill';
import { useToast } from '@/components/Toast';
import { COMMON_MEDICATIONS, findCommonMedication } from '@/constants/commonMedications';
import { MEDICATION_TYPES, type MedicationType } from '@/constants/medicationTypes';
import { useDb } from '@/db/DatabaseProvider';
import {
  archiveMedication,
  createMedication,
  listMedicationLogs,
  listMedications,
  logMedication,
  updateMedication,
} from '@/db/repositories/medications';
import type { Medication } from '@/db/schema';
import type { AppDb } from '@/db/types';
import { playChing } from '@/lib/ching';
import { friendlyMessages } from '@/lib/errors';
import { formatTime, localDayKey } from '@/lib/localDay';
import { logger } from '@/lib/logger';
import { medicationSwipe } from '@/lib/logSwipe';
import { formatMealTime } from '@/lib/mealTime';
import { currentTimeZone } from '@/lib/time';
import { medicationTypeLabel } from '@/lib/timeline';
import { fontFamily, minTouchTarget, radius, space, typography, useColors } from '@/theme';

const MAX_NAME = 60;
const MAX_DOSE = 40;
const MAX_NOTE = 500;
/** How long a row says "Logged ✓" (and ignores taps) after a one-tap log, so a double-tap can't log twice. */
const LOGGED_FLASH_MS = 2500;
const DAY_MS = 86_400_000;

/** Dropdown choice for a medication that isn't in the common list. */
const NOT_LISTED = 'not_listed';

type Form = { mode: 'add' } | { mode: 'edit'; id: number };

/** What has been taken today, per saved medication: how many times and when last. */
type TakenToday = Map<number, { count: number; lastAt: string; tz: string }>;

function loadTakenToday(db: AppDb): TakenToday {
  const now = new Date();
  const tz = currentTimeZone();
  const today = localDayKey(now.toISOString(), tz);
  const logs = listMedicationLogs(db, {
    from: new Date(now.getTime() - 2 * DAY_MS).toISOString(),
    to: new Date(now.getTime() + DAY_MS).toISOString(),
  });
  const taken: TakenToday = new Map();
  for (const log of logs) {
    if (log.medicationId === null || localDayKey(log.takenAt, tz) !== today) continue;
    const previous = taken.get(log.medicationId);
    // Logs come oldest first, so the last one seen is the most recent.
    taken.set(log.medicationId, { count: (previous?.count ?? 0) + 1, lastAt: log.takenAt, tz: log.tz });
  }
  return taken;
}

/** "Taken today 8:02 AM (2×)", or "Not taken today". */
const takenTodayLabel = (today: { count: number; lastAt: string; tz: string } | undefined) =>
  today
    ? `Taken today ${formatTime(today.lastAt, today.tz)}${today.count > 1 ? ` (${today.count}×)` : ''}`
    : 'Not taken today';

const doseLabel = (med: Pick<Medication, 'name' | 'defaultDose'>) =>
  med.defaultDose ? `${med.name} ${med.defaultDose}` : med.name;

/**
 * "My medications": one tap logs a saved medication; tap a medication to see it, then edit or remove it;
 * "Log a new medication" saves a new one. Reached from Log → Medication and from Settings.
 */
export default function MedicationScreen() {
  const colors = useColors();
  const db = useDb();
  const toast = useToast();
  const navigation = useNavigation();
  // From Settings > My medications: tap to edit, with a Log button. From Log: tap to log.
  const manage = useLocalSearchParams<{ manage?: string }>().manage === '1';

  const [meds, setMeds] = useState<Medication[]>([]);
  const [taken, setTaken] = useState<TakenToday>(new Map());
  const [loadFailed, setLoadFailed] = useState(false);
  const [justLogged, setJustLogged] = useState<ReadonlySet<number>>(new Set());
  // The medication opened for details (time, dose, note) before logging it, and what has been set so far.
  const [detail, setDetail] = useState<Medication | null>(null);
  const [takenAt, setTakenAt] = useState<Date | null>(null);
  const [timeOpen, setTimeOpen] = useState(false);
  const [detailDose, setDetailDose] = useState('');
  const [detailCustom, setDetailCustom] = useState(false);
  const [detailNote, setDetailNote] = useState('');
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  // The medication tapped in the list: shown in a sheet first; its fields open after Edit.
  const [viewing, setViewing] = useState<Medication | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<MedicationType>('ppi');
  const [dose, setDose] = useState('');
  /** A common medication's name, NOT_LISTED, or null while nothing is chosen yet. */
  const [pick, setPick] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  /** True while the dose is typed in rather than chosen from the common doses. */
  const [customDose, setCustomDose] = useState(false);

  const reload = useCallback(() => {
    try {
      setMeds(listMedications(db));
      setTaken(loadTakenToday(db));
      setLoadFailed(false);
    } catch (error) {
      logger.error('loadMedications', error);
      setLoadFailed(true);
    }
  }, [db]);
  useFocusEffect(reload);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  // Back closes an open form or details page before it leaves the screen.
  const closeForm = useCallback(() => {
    if (form !== null) setForm(null);
    else setDetail(null);
  }, [form]);
  const inner = form !== null || detail !== null;
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!inner) return false;
        closeForm();
        return true;
      });
      return () => subscription.remove();
    }, [inner, closeForm]),
  );
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !inner });
  }, [navigation, inner]);

  const openAdd = () => {
    setName('');
    setType('ppi');
    setDose('');
    setPick(null);
    setPickerOpen(false);
    setCustomDose(false);
    setForm({ mode: 'add' });
  };
  const openEdit = (med: Medication) => {
    const common = findCommonMedication(med.name);
    setName(med.name);
    setType(common?.type ?? med.type);
    setDose(med.defaultDose ?? '');
    setPick(common ? common.name : NOT_LISTED);
    setPickerOpen(false);
    setCustomDose(Boolean(med.defaultDose) && !common?.doses.includes(med.defaultDose ?? ''));
    setForm({ mode: 'edit', id: med.id });
  };

  const choose = (choice: string) => {
    const common = findCommonMedication(choice);
    setPick(choice);
    setPickerOpen(false);
    setDose('');
    setCustomDose(false);
    if (common) {
      setName(common.name);
      setType(common.type);
    } else {
      setName('');
    }
  };
  const chosen = pick === null || pick === NOT_LISTED ? undefined : findCommonMedication(pick);
  const pickerLabel = pick === null ? 'Choose a medication' : chosen ? chosen.name : 'Not listed';

  const openDetail = (med: Medication) => {
    const common = findCommonMedication(med.name);
    setDetail(med);
    setTakenAt(null);
    setDetailDose(med.defaultDose ?? '');
    setDetailCustom(Boolean(med.defaultDose) && !common?.doses.includes(med.defaultDose ?? ''));
    setDetailNote('');
  };

  const pickTime = () => {
    if (Platform.OS === 'android') pickTimeAndroid(takenAt ?? new Date(), setTakenAt);
    else setTimeOpen(true);
  };

  /** Logs the dose now, or with the dose, time and note set on its details page. */
  const logDose = (
    med: Medication,
    extras?: { at: Date | null; doseText?: string; notes?: string },
  ): boolean => {
    // `disabled` only applies after a re-render, so two taps in the same instant on a Log pill must be
    // caught here. A dose logged from its details page was chosen deliberately, so it is never dropped.
    if (!extras && timers.current.has(med.id)) return false;
    try {
      logMedication(db, med.id, {
        ...(extras?.at ? { takenAt: extras.at.toISOString() } : {}),
        doseText: extras?.doseText,
        notes: extras?.notes,
      });
    } catch (error) {
      logger.error('logMedication', error);
      Alert.alert("Couldn't log", friendlyMessages.INTERNAL);
      return false;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    playChing();
    // An earlier dose doesn't show under "Taken today", so the toast says when it was logged for.
    toast(
      extras?.at ? `${med.name} logged for ${formatMealTime(extras.at, new Date())}` : `${med.name} logged`,
    );
    setJustLogged((current) => new Set(current).add(med.id));
    clearTimeout(timers.current.get(med.id));
    timers.current.set(
      med.id,
      setTimeout(() => {
        timers.current.delete(med.id);
        setJustLogged((current) => {
          const next = new Set(current);
          next.delete(med.id);
          return next;
        });
      }, LOGGED_FLASH_MS),
    );
    reload();
    return true;
  };

  const trimmedName = name.trim();
  const save = () => {
    if (form === null) return;
    const input = { name: trimmedName, type, defaultDose: dose };
    try {
      if (form.mode === 'add') createMedication(db, input);
      else updateMedication(db, form.id, input);
    } catch (error) {
      logger.error(form.mode === 'add' ? 'createMedication' : 'updateMedication', error);
      Alert.alert("Couldn't save", friendlyMessages.INTERNAL);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast(form.mode === 'add' ? `${trimmedName} added` : 'Changes saved');
    setForm(null);
    reload();
  };

  const confirmRemove = (med: Medication) => {
    Alert.alert(`Remove ${med.name}?`, 'It leaves your list, but past logs stay in Your Logs.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          try {
            archiveMedication(db, med.id);
          } catch (error) {
            logger.error('archiveMedication', error);
            Alert.alert("Couldn't remove", friendlyMessages.INTERNAL);
            return;
          }
          toast('Removed from your list');
          setViewing(null);
          reload();
        },
      },
    ]);
  };

  if (form !== null) {
    return (
      <Screen style={styles.screen}>
        <BackHeader title={form.mode === 'add' ? 'Add medication' : 'Edit medication'} onBack={closeForm} />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <AppText variant="label" color="inkSoft" style={styles.fieldLabel}>
              Medication
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Medication"
              accessibilityValue={{ text: pickerLabel }}
              accessibilityState={{ expanded: pickerOpen }}
              onPress={() => setPickerOpen((open) => !open)}
              style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
              <AppText color={pick === null ? 'inkSoft' : 'ink'} style={styles.pickerText} numberOfLines={1}>
                {pickerLabel}
              </AppText>
              {pickerOpen ? (
                <ChevronUp size={20} color={colors.inkSoft} />
              ) : (
                <ChevronDown size={20} color={colors.inkSoft} />
              )}
            </Pressable>
            {pickerOpen && (
              <View
                accessibilityRole="radiogroup"
                style={[styles.options, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
                {MEDICATION_TYPES.filter((group) =>
                  COMMON_MEDICATIONS.some((med) => med.type === group.key),
                ).map((group) => (
                  <View key={group.key}>
                    <AppText variant="caption" color="inkSoft" style={styles.groupLabel}>
                      {group.label}
                    </AppText>
                    {COMMON_MEDICATIONS.filter((med) => med.type === group.key).map((med) => (
                      <Pressable
                        key={med.name}
                        accessibilityRole="radio"
                        accessibilityLabel={med.name}
                        accessibilityState={{ checked: pick === med.name }}
                        onPress={() => choose(med.name)}
                        style={styles.option}>
                        <AppText style={styles.optionText}>{med.name}</AppText>
                      </Pressable>
                    ))}
                  </View>
                ))}
                <Pressable
                  accessibilityRole="radio"
                  accessibilityLabel="Not listed? Enter your own"
                  accessibilityState={{ checked: pick === NOT_LISTED }}
                  onPress={() => choose(NOT_LISTED)}
                  style={[styles.option, styles.notListed, { borderColor: colors.hairline }]}>
                  <AppText style={[styles.optionText, { color: colors.clayInk }]}>
                    Not listed? Enter your own
                  </AppText>
                </Pressable>
              </View>
            )}
            <View style={styles.spacer} />

            {pick === NOT_LISTED && (
              <>
                <TextField
                  label="Name"
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Zegerid"
                  maxLength={MAX_NAME}
                  autoCapitalize="words"
                />
                <AppText variant="label" color="inkSoft" style={styles.fieldLabel}>
                  Type
                </AppText>
                <View accessibilityRole="radiogroup" style={styles.types}>
                  {MEDICATION_TYPES.map((option) => (
                    <TagChip
                      key={option.key}
                      role="radio"
                      label={option.label}
                      selected={type === option.key}
                      onPress={() => setType(option.key)}
                    />
                  ))}
                </View>
              </>
            )}

            {chosen && (
              <>
                <AppText variant="caption" color="inkSoft" style={styles.typeNote}>
                  {`Type: ${medicationTypeLabel(chosen.type)}`}
                </AppText>
                <AppText variant="label" color="inkSoft" style={styles.fieldLabel}>
                  Dose (optional)
                </AppText>
                <View accessibilityRole="radiogroup" style={styles.types}>
                  {chosen.doses.map((option) => (
                    <TagChip
                      key={option}
                      role="radio"
                      label={option}
                      selected={!customDose && dose === option}
                      onPress={() => {
                        // Tapping the chosen dose again clears it.
                        setDose(dose === option && !customDose ? '' : option);
                        setCustomDose(false);
                      }}
                    />
                  ))}
                  <TagChip
                    role="radio"
                    label="Other dose"
                    selected={customDose}
                    onPress={() => {
                      setCustomDose(true);
                      setDose('');
                    }}
                  />
                </View>
              </>
            )}
            {(pick === NOT_LISTED || customDose) && (
              <TextField
                label="Dose"
                hint="(optional)"
                value={dose}
                onChangeText={setDose}
                placeholder="e.g. 20mg"
                maxLength={MAX_DOSE}
              />
            )}
          </ScrollView>
          <View style={styles.footer}>
            <Button
              label={form.mode === 'add' ? 'Add medication' : 'Save changes'}
              onPress={save}
              disabled={trimmedName.length === 0}
              accessibilityHint={
                trimmedName.length === 0 ? 'Choose a medication or enter a name first' : undefined
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  if (detail !== null) {
    const common = findCommonMedication(detail.name);
    return (
      <Screen style={styles.screen}>
        <BackHeader onBack={closeForm} />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.detailContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <AppText variant="display" accessibilityRole="header">
              {detail.name}
            </AppText>
            <View style={styles.timeRow}>
              <TimePill label={formatMealTime(takenAt, new Date())} onPress={pickTime} />
              <View style={[styles.typeBadge, { backgroundColor: colors.surface }]}>
                <AppText style={styles.typeBadgeText}>{medicationTypeLabel(detail.type)}</AppText>
              </View>
            </View>
            <View style={styles.section}>
              <AppText variant="section">Dose</AppText>
              {common && (
                <View accessibilityRole="radiogroup" style={styles.types}>
                  {common.doses.map((option) => (
                    <TagChip
                      key={option}
                      role="radio"
                      label={option}
                      selected={!detailCustom && detailDose === option}
                      onPress={() => {
                        // Tapping the chosen dose again clears it.
                        setDetailDose(detailDose === option && !detailCustom ? '' : option);
                        setDetailCustom(false);
                      }}
                    />
                  ))}
                  <TagChip
                    role="radio"
                    label="Other"
                    selected={detailCustom}
                    onPress={() => {
                      setDetailCustom(true);
                      setDetailDose('');
                    }}
                  />
                </View>
              )}
              {(!common || detailCustom) && (
                <TextField
                  label="Dose"
                  hideLabel
                  value={detailDose}
                  onChangeText={setDetailDose}
                  placeholder="e.g. 20mg"
                  maxLength={MAX_DOSE}
                />
              )}
            </View>
            <View style={styles.section}>
              <AppText variant="section">Note</AppText>
              <TextField
                label="Note"
                hideLabel
                value={detailNote}
                onChangeText={setDetailNote}
                placeholder="e.g. Taken with breakfast"
                maxLength={MAX_NOTE}
              />
            </View>
          </ScrollView>
          <View style={styles.footer}>
            <Button
              label="Log dose"
              onPress={() => {
                // Stay on the page (keeping what was typed) if the dose could not be saved.
                if (logDose(detail, { at: takenAt, doseText: detailDose, notes: detailNote }))
                  setDetail(null);
              }}
            />
          </View>
        </KeyboardAvoidingView>
        <MealTimeSheet
          visible={timeOpen}
          question="When did you take this?"
          confirmLabel="Set time"
          onConfirm={(at) => {
            setTimeOpen(false);
            setTakenAt(at);
          }}
          onClose={() => setTimeOpen(false)}
        />
      </Screen>
    );
  }

  return (
    <SwipeNav {...medicationSwipe} enabled={viewing === null}>
      <Screen style={styles.screen}>
        <BackHeader />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <AppText variant="display" accessibilityRole="header">
            {manage ? 'My medications' : 'Which medication?'}
          </AppText>
          <AppText color="inkSoft" style={styles.subtitle}>
            {manage ? 'Tap a medication to see it.' : 'Tap to log a dose now.'}
          </AppText>
          {loadFailed && meds.length === 0 ? (
            <AppText color="inkSoft" style={styles.empty}>
              {`${friendlyMessages.INTERNAL} Your medications are still on this phone.`}
            </AppText>
          ) : meds.length === 0 ? (
            <AppText color="inkSoft" style={styles.empty}>
              Add the medications you take, then log each one with a single tap.
            </AppText>
          ) : (
            meds.map((med) => {
              const today = taken.get(med.id);
              const done = justLogged.has(med.id);
              return (
                <View key={med.id} style={[styles.card, { backgroundColor: colors.surface }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={doseLabel(med)}
                    accessibilityHint={manage ? 'Shows its details' : 'Opens time, dose and note'}
                    onPress={() => (manage ? setViewing(med) : openDetail(med))}
                    style={styles.info}>
                    <View style={[styles.icon, { backgroundColor: colors.clayTint }]}>
                      <Pill size={18} color={colors.clayInk} strokeWidth={2.2} />
                    </View>
                    <View style={styles.text}>
                      <AppText style={styles.medName} numberOfLines={2}>
                        {doseLabel(med)}
                      </AppText>
                      <AppText variant="caption" color="inkSoft">
                        {medicationTypeLabel(med.type)}
                        {today ? ` · ${takenTodayLabel(today)}` : ''}
                      </AppText>
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={done ? `${med.name} logged` : `Log ${doseLabel(med)}`}
                    accessibilityState={{ disabled: done }}
                    disabled={done}
                    onPress={() => logDose(med)}
                    style={({ pressed }) => [
                      styles.logButton,
                      {
                        backgroundColor: done ? colors.sageInk : colors.sageTint,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}>
                    <AppText style={[styles.logText, { color: done ? colors.ctaInk : colors.sageInk }]}>
                      {done ? 'Logged ✓' : 'Log'}
                    </AppText>
                  </Pressable>
                </View>
              );
            })
          )}
        </ScrollView>
        <View style={styles.footer}>
          <Button label="Add a medication" variant="secondary" onPress={openAdd} />
        </View>

        {/* Like a saved food: the medication first; Edit opens its fields. */}
        <BottomSheet visible={viewing !== null} onClose={() => setViewing(null)}>
          {viewing && (
            <>
              <AppText variant="title" accessibilityRole="header">
                {doseLabel(viewing)}
              </AppText>
              <AppText color="inkSoft" style={styles.sheetMeta}>
                {medicationTypeLabel(viewing.type)}
                {' · '}
                {takenTodayLabel(taken.get(viewing.id))}
              </AppText>
              <Button
                label="Edit"
                onPress={() => {
                  const med = viewing;
                  setViewing(null);
                  openEdit(med);
                }}
              />
              <View style={styles.secondary}>
                <Button
                  label="Remove from my list"
                  variant="quietDanger"
                  onPress={() => confirmRemove(viewing)}
                />
              </View>
            </>
          )}
        </BottomSheet>
      </Screen>
    </SwipeNav>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  flex: { flex: 1 },
  content: { paddingBottom: space.s3 },
  detailContent: { paddingBottom: space.s3, gap: space.s3 },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: 4, marginBottom: space.s3 },
  empty: { marginBottom: space.s2, lineHeight: 24 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeBadge: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill },
  typeBadgeText: { ...typography.label, fontSize: 13 },
  section: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    borderRadius: radius.lg,
    paddingVertical: space.s1,
    paddingLeft: space.s1,
    paddingRight: space.s1,
    marginBottom: space.s1,
  },
  info: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: minTouchTarget,
    padding: 4,
  },
  icon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  medName: { ...typography.bodyEm, fontSize: 15, lineHeight: 20, fontFamily: fontFamily.bold },
  logButton: {
    minWidth: 76,
    minHeight: minTouchTarget,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logText: { ...typography.label, fontSize: 14, fontFamily: fontFamily.extrabold },
  fieldLabel: { marginBottom: space.s1 },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s1,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
  },
  pickerText: { flex: 1, fontSize: 16 },
  options: { borderWidth: 1, borderRadius: radius.lg, marginTop: 6, paddingBottom: 4, overflow: 'hidden' },
  groupLabel: { paddingHorizontal: 16, paddingTop: space.s1, paddingBottom: 2 },
  option: { minHeight: minTouchTarget, justifyContent: 'center', paddingHorizontal: 16 },
  optionText: { fontSize: 15, fontFamily: fontFamily.bold },
  notListed: { borderTopWidth: 1, marginTop: 6 },
  spacer: { height: space.s2 },
  typeNote: { marginBottom: space.s2 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1, marginBottom: space.s2 },
  footer: { paddingTop: space.s1, paddingBottom: space.s2 },
  secondary: { marginTop: space.s1 },
  sheetMeta: { marginTop: 4, marginBottom: space.s2 },
});
