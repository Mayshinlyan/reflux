import * as Haptics from 'expo-haptics';
import { useFocusEffect, useNavigation } from 'expo-router';
import { Pill } from 'lucide-react-native';
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
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TagChip } from '@/components/TagChip';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
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
import { friendlyMessages } from '@/lib/errors';
import { formatTime, localDayKey } from '@/lib/localDay';
import { logger } from '@/lib/logger';
import { currentTimeZone } from '@/lib/time';
import { medicationTypeLabel } from '@/lib/timeline';
import { minTouchTarget, radius, space, typography, useColors } from '@/theme';

const MAX_NAME = 60;
const MAX_DOSE = 40;
/** How long a row says "Logged ✓" (and ignores taps) after a one-tap log, so a double-tap can't log twice. */
const LOGGED_FLASH_MS = 2500;
const DAY_MS = 86_400_000;

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

const doseLabel = (med: Pick<Medication, 'name' | 'defaultDose'>) =>
  med.defaultDose ? `${med.name} ${med.defaultDose}` : med.name;

/**
 * "My medications": one tap logs a saved medication; tap a medication to edit or remove it;
 * "Add a medication" saves a new one. Reached from Log → Medication and from Settings.
 */
export default function MedicationScreen() {
  const colors = useColors();
  const db = useDb();
  const toast = useToast();
  const navigation = useNavigation();

  const [meds, setMeds] = useState<Medication[]>([]);
  const [taken, setTaken] = useState<TakenToday>(new Map());
  const [loadFailed, setLoadFailed] = useState(false);
  const [justLogged, setJustLogged] = useState<ReadonlySet<number>>(new Set());
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const [form, setForm] = useState<Form | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<MedicationType>('ppi');
  const [dose, setDose] = useState('');

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

  // Back closes an open form before it leaves the screen.
  const closeForm = useCallback(() => setForm(null), []);
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (form === null) return false;
        closeForm();
        return true;
      });
      return () => subscription.remove();
    }, [form, closeForm]),
  );
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: form === null });
  }, [navigation, form]);

  const openAdd = () => {
    setName('');
    setType('ppi');
    setDose('');
    setForm({ mode: 'add' });
  };
  const openEdit = (med: Medication) => {
    setName(med.name);
    setType(med.type);
    setDose(med.defaultDose ?? '');
    setForm({ mode: 'edit', id: med.id });
  };

  const logOnce = (med: Medication) => {
    // `disabled` only applies after a re-render, so two taps in the same instant must be caught here.
    if (timers.current.has(med.id)) return;
    try {
      logMedication(db, med.id);
    } catch (error) {
      logger.error('logMedication', error);
      Alert.alert("Couldn't log", friendlyMessages.INTERNAL);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast(`${med.name} logged`);
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

  const confirmRemove = () => {
    if (form?.mode !== 'edit') return;
    const id = form.id;
    Alert.alert(
      `Remove ${trimmedName || 'this medication'}?`,
      'It leaves your list, but past logs stay in History.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            try {
              archiveMedication(db, id);
            } catch (error) {
              logger.error('archiveMedication', error);
              Alert.alert("Couldn't remove", friendlyMessages.INTERNAL);
              return;
            }
            toast('Removed from your list');
            setForm(null);
            reload();
          },
        },
      ],
    );
  };

  if (form !== null) {
    return (
      <Screen style={styles.screen}>
        <BackHeader title={form.mode === 'add' ? 'Add medication' : 'Edit medication'} onBack={closeForm} />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <TextField
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Pepcid"
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
            <TextField
              label="Dose"
              hint="(optional)"
              value={dose}
              onChangeText={setDose}
              placeholder="e.g. 20mg"
              maxLength={MAX_DOSE}
            />
          </ScrollView>
          <View style={styles.footer}>
            <Button
              label={form.mode === 'add' ? 'Add medication' : 'Save changes'}
              onPress={save}
              disabled={trimmedName.length === 0}
              accessibilityHint={trimmedName.length === 0 ? 'Enter a name first' : undefined}
            />
            {form.mode === 'edit' && (
              <View style={styles.secondary}>
                <Button label="Remove from my list" variant="quietDanger" onPress={confirmRemove} />
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <BackHeader title="Medications" />
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
              <View
                key={med.id}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${doseLabel(med)}`}
                  onPress={() => openEdit(med)}
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
                      {today
                        ? ` · Taken today ${formatTime(today.lastAt, today.tz)}${today.count > 1 ? ` (${today.count}×)` : ''}`
                        : ''}
                    </AppText>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={done ? `${med.name} logged` : `Log ${doseLabel(med)}`}
                  accessibilityState={{ disabled: done }}
                  disabled={done}
                  onPress={() => logOnce(med)}
                  style={({ pressed }) => [
                    styles.logButton,
                    { backgroundColor: done ? colors.sageInk : colors.sageTint, opacity: pressed ? 0.8 : 1 },
                  ]}>
                  <AppText style={[styles.logText, { color: done ? colors.ctaInk : colors.sageInk }]}>
                    {done ? 'Logged ✓' : 'Log'}
                  </AppText>
                </Pressable>
              </View>
            );
          })
        )}
        <Pressable accessibilityRole="button" onPress={openAdd} style={styles.add}>
          <AppText style={[styles.addText, { color: colors.clayInk }]}>+ Add a medication</AppText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  flex: { flex: 1 },
  content: { paddingBottom: space.s4 },
  empty: { marginBottom: space.s2, lineHeight: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    borderWidth: 1,
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
  medName: { ...typography.bodyEm, fontSize: 15, lineHeight: 20, fontFamily: 'Nunito_700Bold' },
  logButton: {
    minWidth: 76,
    minHeight: minTouchTarget,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logText: { ...typography.label, fontSize: 14, fontFamily: 'Nunito_800ExtraBold' },
  add: { minHeight: minTouchTarget, justifyContent: 'center', paddingVertical: space.s1 },
  addText: { ...typography.bodyEm, fontSize: 15, fontFamily: 'Nunito_700Bold' },
  fieldLabel: { marginBottom: space.s1 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1, marginBottom: space.s2 },
  footer: { paddingTop: space.s1, paddingBottom: space.s2 },
  secondary: { marginTop: space.s1 },
});
