import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Camera, Images } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { CircleActionButton } from '@/components/CircleActionButton';
import { FoodLoading } from '@/components/FoodLoading';
import { MealResultCard } from '@/components/MealResultCard';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { useDb } from '@/db/DatabaseProvider';
import { createFoodLog } from '@/db/repositories/food';
import { useAnalyzeFood } from '@/hooks/useAnalyzeFood';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { deletePhoto, savePhoto } from '@/services/photoStore';
import { type PhotoSource, pickFoodPhoto } from '@/services/photoPicker';
import { radius, space, useColors } from '@/theme';

const MAX_TEXT = 200;
const CAMERA_DENIED =
  'Camera access is off. You can turn it on in Settings, choose a photo instead, or type it in.';

/** What was actually sent, so an edit while loading can't mismatch the saved entry. */
type Analyzed = { source: 'text'; text: string } | { source: 'photo'; uri: string };

/** Log food from a photo or a typed description: relay analysis, a result card, then save to the diary. */
export default function LogFoodScreen() {
  const colors = useColors();
  const db = useDb();
  const toast = useToast();
  const { state, analyze, reset } = useAnalyzeFood();
  const [text, setText] = useState('');
  const [analyzed, setAnalyzed] = useState<Analyzed | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const saving = useRef(false);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const busy = preparing || state.status === 'loading';
  const trimmed = text.trim();

  const checkText = () => {
    if (!trimmed || busy) return;
    setNotice(null);
    setAnalyzed({ source: 'text', text: trimmed });
    void analyze({ text: trimmed });
  };

  const checkPhoto = async (source: PhotoSource) => {
    if (busy) return;
    setNotice(null);
    try {
      const picked = await pickFoodPhoto(source, () => {
        if (alive.current) setPreparing(true);
      });
      if (!alive.current) return;
      if (picked.status === 'denied') setNotice(CAMERA_DENIED);
      if (picked.status !== 'ok') return;
      setAnalyzed({ source: 'photo', uri: picked.photo.uri });
      void analyze({ photo: { uri: picked.photo.uri, mimeType: 'image/jpeg' } });
    } catch {
      // Code only: the picker or manipulator error could carry file paths.
      logger.error('preparePhoto', new AppError('INPUT_REJECTED'));
      if (alive.current) setNotice(new AppError('INPUT_REJECTED').friendlyMessage);
    } finally {
      if (alive.current) setPreparing(false);
    }
  };

  const save = () => {
    if (state.status !== 'done' || !analyzed || saving.current) return;
    saving.current = true;
    const { meta, ...analysis } = state.result;
    let storedPhoto: string | null = null;
    try {
      if (analyzed.source === 'photo') storedPhoto = savePhoto(analyzed.uri);
      createFoodLog(db, {
        entryType: 'diary',
        source: analyzed.source,
        inputText: analyzed.source === 'text' ? analyzed.text : null,
        photoUri: storedPhoto,
        analysis,
        meta,
      });
    } catch {
      saving.current = false;
      if (storedPhoto) deletePhoto(storedPhoto);
      // Code only: a raw error could echo the food text or a file path.
      logger.error('saveFoodLog', new AppError('INTERNAL'));
      toast("We couldn't save that. Please try again.");
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast('Meal logged');
    router.back();
  };

  const tryAnother = () => {
    setAnalyzed(null);
    reset();
  };

  return (
    <Screen>
      <BackHeader title="Log food" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {state.status === 'done' ? (
            <>
              {analyzed?.source === 'photo' && (
                <Image
                  source={{ uri: analyzed.uri }}
                  style={styles.photo}
                  contentFit="cover"
                  accessibilityLabel="Your meal photo"
                />
              )}
              <MealResultCard analysis={state.result} />
              <AppText variant="caption" color="inkSoft" style={styles.disclaimer}>
                For tracking only, not medical advice. Food results are AI-generated.
              </AppText>
            </>
          ) : busy ? (
            <FoodLoading
              source={preparing ? 'photo' : (analyzed?.source ?? 'text')}
              photoUri={!preparing && analyzed?.source === 'photo' ? analyzed.uri : undefined}
            />
          ) : (
            <>
              <AppText color="inkSoft" style={styles.subtitle}>
                What did you eat? We&apos;ll work out the ingredients.
              </AppText>
              <View style={styles.capture}>
                <CircleActionButton
                  large
                  variant="primary"
                  label="Take a photo"
                  icon={Camera}
                  onPress={() => void checkPhoto('camera')}
                />
                <CircleActionButton
                  large
                  label="Choose a photo"
                  icon={Images}
                  onPress={() => void checkPhoto('library')}
                />
              </View>
              <AppText variant="caption" color="inkSoft" style={styles.or}>
                or type it
              </AppText>
              <TextField
                label="What did you eat?"
                value={text}
                onChangeText={setText}
                placeholder="e.g. spicy chicken tacos"
                maxLength={MAX_TEXT}
                returnKeyType="done"
                onSubmitEditing={checkText}
              />
              {(notice || state.status === 'error') && (
                <View accessibilityRole="alert" style={[styles.error, { backgroundColor: colors.redTint }]}>
                  <AppText color="redInk">
                    {notice ?? (state.status === 'error' ? state.error.friendlyMessage : '')}
                  </AppText>
                </View>
              )}
              <Button
                label={state.status === 'error' && analyzed?.source === 'text' ? 'Try again' : 'Check it'}
                onPress={checkText}
                disabled={!trimmed}
              />
            </>
          )}
        </ScrollView>
        {/* Outside the scroll area so Save is always on screen, however long the result is. */}
        {state.status === 'done' && (
          <View style={styles.footer}>
            <Button label="Save to diary" onPress={save} />
            <Button label="Try something else" variant="secondary" onPress={tryAnother} />
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: space.s3 },
  subtitle: { marginBottom: space.s2 },
  or: { textAlign: 'center', marginVertical: space.s2 },
  disclaimer: { textAlign: 'center', marginVertical: space.s1 },
  capture: { flexDirection: 'row', justifyContent: 'center', gap: space.s4, marginVertical: space.s2 },
  footer: { gap: space.s1, paddingTop: space.s1 },
  photo: { width: '100%', height: 200, borderRadius: radius.lg, marginBottom: space.s1 },
  error: { borderRadius: radius.md, padding: space.s2, marginBottom: space.s2 },
});
