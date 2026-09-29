import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { MealResultCard } from '@/components/MealResultCard';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { useDb } from '@/db/DatabaseProvider';
import { createFoodLog } from '@/db/repositories/food';
import { useAnalyzeFood } from '@/hooks/useAnalyzeFood';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { space, useColors } from '@/theme';

const MAX_TEXT = 200;

/** Log food by typing what was eaten: relay analysis, a result card, then save to the diary. */
export default function LogFoodScreen() {
  const colors = useColors();
  const db = useDb();
  const toast = useToast();
  const { state, analyze, reset } = useAnalyzeFood();
  const [text, setText] = useState('');
  // The text that was actually sent, so an edit while loading can't mismatch the saved entry.
  const [analyzedText, setAnalyzedText] = useState('');
  const saving = useRef(false);

  const trimmed = text.trim();
  const check = () => {
    if (!trimmed || state.status === 'loading') return;
    setAnalyzedText(trimmed);
    void analyze({ text: trimmed });
  };

  const save = () => {
    if (state.status !== 'done' || saving.current) return;
    saving.current = true;
    const { meta, ...analysis } = state.result;
    try {
      createFoodLog(db, { entryType: 'diary', source: 'text', inputText: analyzedText, analysis, meta });
    } catch {
      saving.current = false;
      // Code only: a raw DB error could echo the food text in dev console output.
      logger.error('saveFoodLog', new AppError('INTERNAL'));
      toast("We couldn't save that. Please try again.");
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast('Meal logged');
    router.back();
  };

  return (
    <Screen>
      <BackHeader title="Log food" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {state.status === 'done' ? (
            <>
              <MealResultCard analysis={state.result} />
              <AppText variant="caption" color="inkSoft" style={styles.disclaimer}>
                For tracking only, not medical advice. Food results are AI-generated.
              </AppText>
              <View style={styles.actions}>
                <Button label="Save to diary" onPress={save} />
                <Button label="Try something else" variant="secondary" onPress={reset} />
              </View>
            </>
          ) : (
            <>
              <AppText color="inkSoft" style={styles.subtitle}>
                What did you eat? We&apos;ll work out the ingredients.
              </AppText>
              <TextField
                label="What did you eat?"
                value={text}
                onChangeText={setText}
                placeholder="e.g. spicy chicken tacos"
                maxLength={MAX_TEXT}
                returnKeyType="done"
                onSubmitEditing={check}
              />
              {state.status === 'error' && (
                <View accessibilityRole="alert" style={[styles.error, { backgroundColor: colors.redTint }]}>
                  <AppText color="redInk">{state.error.friendlyMessage}</AppText>
                </View>
              )}
              {state.status === 'loading' ? (
                <View style={styles.loading} accessibilityLiveRegion="polite">
                  <ActivityIndicator color={colors.cta} />
                  <AppText color="inkSoft">Looking at your food…</AppText>
                </View>
              ) : (
                <Button
                  label={state.status === 'error' ? 'Try again' : 'Check it'}
                  onPress={check}
                  disabled={!trimmed}
                />
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: space.s3 },
  subtitle: { marginBottom: space.s2 },
  disclaimer: { textAlign: 'center', marginVertical: space.s1 },
  actions: { gap: space.s1 },
  error: { borderRadius: 12, padding: space.s2, marginBottom: space.s2 },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s1,
    minHeight: 52,
  },
});
