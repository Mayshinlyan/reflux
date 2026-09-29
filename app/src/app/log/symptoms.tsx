import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { SymptomChip } from '@/components/SymptomChip';
import { TagChip } from '@/components/TagChip';
import { useToast } from '@/components/Toast';
import { LIFESTYLE_TAGS, type LifestyleTagKey } from '@/constants/lifestyleTags';
import { SYMPTOM_ITEMS, type SymptomKey } from '@/constants/symptomItems';
import { useDb } from '@/db/DatabaseProvider';
import { createSymptomLog, getSymptomLog, updateSymptomLog } from '@/db/repositories/symptoms';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { radius, space, typography, useColors } from '@/theme';

/** A newly tapped symptom starts in the middle of the scale, as in the mockup. */
const DEFAULT_SCORE = 3;
const MAX_NOTE_LENGTH = 1000;

/** Quick symptom log. With `?id=`, edits that entry instead. */
export default function LogSymptomsScreen() {
  const colors = useColors();
  const db = useDb();
  const toast = useToast();
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

  const [scores, setScores] = useState<Partial<Record<SymptomKey, number>>>(() =>
    Object.fromEntries(existing?.items.map((item) => [item.key, item.score]) ?? []),
  );
  const [tags, setTags] = useState<Set<LifestyleTagKey>>(() => new Set(existing?.tags ?? []));
  const [note, setNote] = useState(existing?.notes ?? '');

  const selectedCount = Object.keys(scores).length;

  const toggleSymptom = (key: SymptomKey) => {
    Haptics.selectionAsync().catch(() => {});
    setScores((current) => {
      const next = { ...current };
      if (next[key] === undefined) next[key] = DEFAULT_SCORE;
      else delete next[key];
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
    // Keep the chips' on-screen order rather than tap order.
    const items = SYMPTOM_ITEMS.filter((item) => scores[item.key] !== undefined).map((item) => ({
      key: item.key,
      score: scores[item.key] as number,
    }));
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

  if (editingId !== undefined && !existing) {
    return (
      <Screen>
        <BackHeader title="Edit symptoms" />
        <AppText color="inkSoft">This entry no longer exists.</AppText>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BackHeader title={editingId !== undefined ? 'Edit symptoms' : 'Log symptoms'} />
          <AppText color="inkSoft" style={styles.subtitle}>
            Tap what you&apos;re feeling right now, then how strong it is.
          </AppText>

          <View style={styles.grid}>
            {SYMPTOM_ITEMS.map((item) => (
              <SymptomChip
                key={item.key}
                label={item.label}
                score={scores[item.key]}
                onToggle={() => toggleSymptom(item.key)}
                onScoreChange={(score) => setScores((current) => ({ ...current, [item.key]: score }))}
              />
            ))}
          </View>

          <SectionTitle>Anything else going on?</SectionTitle>
          <View style={styles.grid}>
            {LIFESTYLE_TAGS.map((tag) => (
              <TagChip
                key={tag.key}
                label={tag.label}
                selected={tags.has(tag.key)}
                onPress={() => toggleTag(tag.key)}
              />
            ))}
          </View>

          <SectionTitle>Note (optional)</SectionTitle>
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
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={editingId !== undefined ? 'Save changes' : 'Save entry'}
            onPress={save}
            disabled={selectedCount === 0}
            accessibilityHint={selectedCount === 0 ? 'Choose at least one symptom first' : undefined}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  flex: { flex: 1 },
  content: { paddingBottom: space.s3 },
  subtitle: { fontSize: 15, lineHeight: 21, marginBottom: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  note: {
    ...typography.body,
    fontSize: 15,
    minHeight: 88,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  footer: { paddingVertical: space.s2 },
});
