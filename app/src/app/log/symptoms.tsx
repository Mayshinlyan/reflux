import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { BodyMap } from '@/components/BodyMap';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { StepTracker } from '@/components/StepTracker';
import { SymptomChip } from '@/components/SymptomChip';
import { TagChip } from '@/components/TagChip';
import { useToast } from '@/components/Toast';
import { BODY_ZONES, type ZoneKey, zoneLabel, zoneSymptoms } from '@/constants/bodyZones';
import { LIFESTYLE_TAGS, type LifestyleTagKey } from '@/constants/lifestyleTags';
import { SYMPTOM_ITEMS, type SymptomKey } from '@/constants/symptomItems';
import { useDb } from '@/db/DatabaseProvider';
import { createSymptomLog, getSymptomLog, updateSymptomLog } from '@/db/repositories/symptoms';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { radius, space, typography, useColors } from '@/theme';

const MAX_NOTE_LENGTH = 1000;
const TOTAL_STEPS = 3;
const STEP_CAPTIONS = ['Where it bothers you', 'Anything else', 'Add a note'] as const;

/**
 * Symptom log in three short steps: (1) tap the body area and choose symptoms, (2) tag
 * anything else going on, (3) an optional note, then save. With `?id=`, edits that entry.
 */
export default function LogSymptomsScreen() {
  const colors = useColors();
  const db = useDb();
  const toast = useToast();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ id?: string }>();
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

  const [selected, setSelected] = useState<Set<SymptomKey>>(() => new Set(existing?.items.map((i) => i.key)));
  const [tags, setTags] = useState<Set<LifestyleTagKey>>(() => new Set(existing?.tags ?? []));
  const [note, setNote] = useState(existing?.notes ?? '');
  const [step, setStep] = useState(1);
  /** The body area whose symptom list is open (instead of the step content), if any. */
  const [zone, setZone] = useState<ZoneKey | null>(null);
  const scroll = useRef<ScrollView>(null);

  const inner = zone !== null || step > 1;

  const goBack = useCallback(() => {
    if (zone !== null) setZone(null);
    else if (step > 1) setStep(step - 1);
    else router.back();
  }, [zone, step]);

  // Back walks through the inner steps first, so leaving never drops a half-finished log by accident.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!inner) return false;
        goBack();
        return true;
      });
      return () => subscription.remove();
    }, [inner, goBack]),
  );
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !inner });
  }, [navigation, inner]);

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    scroll.current?.scrollTo({ y: 0, animated: false });
    if (zone === null) {
      AccessibilityInfo.announceForAccessibility(
        `Step ${step} of ${TOTAL_STEPS}. ${STEP_CAPTIONS[step - 1] ?? ''}`,
      );
    }
  }, [step, zone]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        BODY_ZONES.map((z) => [z.key, z.symptoms.filter((key) => selected.has(key)).length]),
      ) as Record<ZoneKey, number>,
    [selected],
  );

  const toggleSymptom = (key: SymptomKey) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleTag = (key: LifestyleTagKey) =>
    setTags((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const save = () => {
    // Keep the canonical symptom order rather than tap order.
    const items = SYMPTOM_ITEMS.filter((item) => selected.has(item.key)).map((item) => ({ key: item.key }));
    const input = { items, tags: [...tags], notes: note };
    try {
      if (editingId !== undefined) updateSymptomLog(db, editingId, input);
      else createSymptomLog(db, input);
    } catch (error) {
      logger.error(editingId !== undefined ? 'updateSymptomLog' : 'createSymptomLog', error);
      Alert.alert("Couldn't save", friendlyMessages.INTERNAL);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast(editingId !== undefined ? 'Entry updated' : 'Symptoms logged');
    router.back();
  };

  const next = () => (step < TOTAL_STEPS ? setStep(step + 1) : save());

  if (editingId !== undefined && !existing) {
    return (
      <Screen>
        <BackHeader title="Edit symptoms" />
        <AppText color="inkSoft">This entry no longer exists.</AppText>
      </Screen>
    );
  }

  const title = zone !== null ? zoneLabel(zone) : editingId !== undefined ? 'Edit symptoms' : 'Log symptoms';

  return (
    <Screen style={styles.screen}>
      <BackHeader title={title} onBack={goBack} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {zone !== null ? (
            <>
              <AppText color="inkSoft" style={styles.subtitle}>
                Tap anything that applies.
              </AppText>
              <View style={styles.chips}>
                {zoneSymptoms(zone).map((key) => (
                  <SymptomChip
                    key={key}
                    label={SYMPTOM_ITEMS.find((item) => item.key === key)?.label ?? key}
                    selected={selected.has(key)}
                    onToggle={() => toggleSymptom(key)}
                  />
                ))}
              </View>
            </>
          ) : step === 1 ? (
            <>
              <AppText color="inkSoft" style={styles.subtitle}>
                Where are you feeling it? Tap a spot.
              </AppText>
              <BodyMap counts={counts} onZonePress={setZone} />
            </>
          ) : step === 2 ? (
            <>
              <AppText variant="title" accessibilityRole="header">
                Anything else going on?
              </AppText>
              <AppText color="inkSoft" style={styles.subtitle}>
                Optional. Tap anything that fits.
              </AppText>
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
            </>
          ) : (
            <>
              <AppText variant="title" accessibilityRole="header">
                Note (optional)
              </AppText>
              <AppText color="inkSoft" style={styles.subtitle}>
                Anything worth remembering about this?
              </AppText>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Anything worth remembering about this…"
                placeholderTextColor={colors.inkSoft}
                multiline
                maxLength={MAX_NOTE_LENGTH}
                accessibilityLabel="Note"
                style={[
                  styles.note,
                  { backgroundColor: colors.surface, borderColor: colors.hairline, color: colors.ink },
                ]}
              />
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {zone !== null ? (
            <Button label="Done" onPress={() => setZone(null)} />
          ) : (
            <>
              {editingId !== undefined ? (
                // Editing: change one thing and save from wherever you are. Next is still there
                // if you want to look at the other steps.
                <>
                  <Button
                    label="Save changes"
                    onPress={save}
                    disabled={selected.size === 0}
                    accessibilityHint={selected.size === 0 ? 'Choose at least one symptom first' : undefined}
                  />
                  {step < TOTAL_STEPS && (
                    <View style={styles.secondary}>
                      <Button
                        label="Next"
                        variant="secondary"
                        onPress={() => setStep(step + 1)}
                        disabled={step === 1 && selected.size === 0}
                      />
                    </View>
                  )}
                </>
              ) : (
                <Button
                  label={step < TOTAL_STEPS ? 'Next' : 'Save entry'}
                  onPress={next}
                  disabled={step === 1 && selected.size === 0}
                  accessibilityHint={
                    step === 1 && selected.size === 0 ? 'Choose at least one symptom first' : undefined
                  }
                />
              )}
              <StepTracker
                step={step}
                total={TOTAL_STEPS}
                caption={STEP_CAPTIONS[step - 1] ?? ''}
                label="Log symptoms progress"
              />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  flex: { flex: 1 },
  content: { paddingBottom: space.s3, flexGrow: 1 },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: 4, marginBottom: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  note: {
    ...typography.body,
    fontSize: 15,
    minHeight: 120,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  footer: { paddingTop: space.s1, paddingBottom: space.s2 },
  secondary: { marginTop: space.s1 },
});
