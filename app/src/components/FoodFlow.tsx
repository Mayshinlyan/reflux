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
import { createFoodLog, promoteCheckToDiary } from '@/db/repositories/food';
import { useAnalyzeFood } from '@/hooks/useAnalyzeFood';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { deletePhoto, savePhoto } from '@/services/photoStore';
import { type AnalysisResult, analyzeFood } from '@/services/relayClient';
import { type PhotoSource, pickFoodPhoto } from '@/services/photoPicker';
import { radius, space, useColors } from '@/theme';

const MAX_TEXT = 200;
/** The relay's cap on `details`; the newest words win when earlier notes and a correction overflow it. */
const MAX_DETAILS = 300;
const CAMERA_DENIED =
  'Camera access is off. You can turn it on in Settings, choose a photo instead, or type it in.';

/** `log` saves an eaten meal straight to the diary; `check` looks at a food before eating it. */
export type FoodFlowMode = 'log' | 'check';

const COPY = {
  log: {
    title: 'Log food',
    intro: "What did you eat? We'll work out the ingredients.",
    textLabel: 'What did you eat?',
    textPlaceholder: 'e.g. spicy chicken tacos',
    correctionNote: "We'll re-check the verdict with this when you save.",
    saveLabel: 'Save to diary',
    saved: 'Meal logged',
  },
  check: {
    title: 'Check a food',
    intro: "See if it's likely to bother your reflux before you eat it.",
    textLabel: 'What are you thinking of eating?',
    textPlaceholder: 'e.g. mint tea',
    correctionNote: "We'll re-check the verdict with this when you tap I ate this.",
    saveLabel: 'I ate this',
    saved: 'Saved to your food diary',
  },
} as const;

/** What was actually sent, so an edit while loading can't mismatch the saved entry. */
type Analyzed = { source: 'text'; text: string } | { source: 'photo'; uri: string };

/**
 * A photo or a typed description → relay analysis → a result card. In `log` mode Save writes a diary
 * entry. In `check` mode each result is kept as a check (outside the diary, so the pet ignores it) and
 * "I ate this" promotes that check, reusing its analysis instead of calling the relay again.
 */
export function FoodFlow({ mode }: { mode: FoodFlowMode }) {
  const copy = COPY[mode];
  const colors = useColors();
  const db = useDb();
  const toast = useToast();
  const { state, analyze, reset } = useAnalyzeFood();
  const [text, setText] = useState('');
  const [analyzed, setAnalyzed] = useState<Analyzed | null>(null);
  // Notes for the AI: `draft` is the photo-review box, `details` what was last sent, `correction` the post-verdict box.
  const [draft, setDraft] = useState('');
  const [details, setDetails] = useState('');
  const [correction, setCorrection] = useState('');
  const [preparing, setPreparing] = useState(false);
  // True while Save re-checks the food with the user's comment before writing the diary entry.
  const [correcting, setCorrecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const saving = useRef(false);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  // Check mode: the stored check for the result on screen, and which result it was stored for.
  const checkId = useRef<number | null>(null);
  const checkedResult = useRef<AnalysisResult | null>(null);
  useEffect(() => {
    if (mode !== 'check' || state.status !== 'done' || !analyzed) return;
    if (checkedResult.current === state.result) return;
    checkedResult.current = state.result;
    checkId.current = null;
    const { meta, ...analysis } = state.result;
    let storedPhoto: string | null = null;
    try {
      if (analyzed.source === 'photo') storedPhoto = savePhoto(analyzed.uri);
      checkId.current = createFoodLog(db, {
        entryType: 'check',
        source: analyzed.source,
        inputText: analyzed.source === 'text' ? analyzed.text : null,
        photoUri: storedPhoto,
        analysis,
        meta,
      });
    } catch {
      if (storedPhoto) deletePhoto(storedPhoto);
      // Code only. Not fatal: "I ate this" then writes the diary entry straight from the result.
      logger.error('saveFoodCheck', new AppError('INTERNAL'));
    }
  }, [mode, state, analyzed, db]);

  const busy = preparing || correcting || state.status === 'loading';
  const showResult = state.status === 'done' && !correcting;
  const trimmed = text.trim();

  const run = (target: Analyzed, notes: string) => {
    setNotice(null);
    setAnalyzed(target);
    setDetails(notes);
    const extra = notes ? { details: notes } : {};
    void analyze(
      target.source === 'text'
        ? { text: target.text, ...extra }
        : { photo: { uri: target.uri, mimeType: 'image/jpeg' }, ...extra },
    );
  };

  const checkText = () => {
    if (!trimmed || busy) return;
    run({ source: 'text', text: trimmed }, details);
  };

  const checkPhotoWithDetails = () => {
    if (busy || analyzed?.source !== 'photo') return;
    run(analyzed, draft.trim());
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
      // Not analyzed yet: the review step lets the user add optional details first.
      setAnalyzed({ source: 'photo', uri: picked.photo.uri });
      setDraft('');
      setDetails('');
      reset();
    } catch {
      // Code only: the picker or manipulator error could carry file paths.
      logger.error('preparePhoto', new AppError('INPUT_REJECTED'));
      if (alive.current) setNotice(new AppError('INPUT_REJECTED').friendlyMessage);
    } finally {
      if (alive.current) setPreparing(false);
    }
  };

  /** `rechecked`: the result came from re-checking with the user's comment, so it replaces a stored check's analysis. */
  const persist = (result: AnalysisResult, rechecked: boolean) => {
    if (!analyzed) return;
    saving.current = true;
    const { meta, ...analysis } = result;
    let storedPhoto: string | null = null;
    try {
      if (checkId.current !== null) {
        promoteCheckToDiary(db, checkId.current, undefined, rechecked ? { analysis, meta } : undefined);
      } else {
        if (analyzed.source === 'photo') storedPhoto = savePhoto(analyzed.uri);
        createFoodLog(db, {
          entryType: 'diary',
          source: analyzed.source,
          inputText: analyzed.source === 'text' ? analyzed.text : null,
          photoUri: storedPhoto,
          analysis,
          meta,
        });
      }
    } catch {
      saving.current = false;
      if (storedPhoto) deletePhoto(storedPhoto);
      // Code only: a raw error could echo the food text or a file path.
      logger.error('saveFoodLog', new AppError('INTERNAL'));
      toast("We couldn't save that. Please try again.");
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast(copy.saved);
    router.back();
  };

  /** With a comment in "Is this right?", the AI re-checks the food with it first, and the corrected verdict is what gets saved. */
  const save = async () => {
    if (state.status !== 'done' || !analyzed || saving.current) return;
    const note = correction.trim();
    if (!note) {
      persist(state.result, false);
      return;
    }
    saving.current = true;
    setCorrecting(true);
    const notes = [details, note].filter(Boolean).join('. ').slice(-MAX_DETAILS);
    try {
      const rechecked = await analyzeFood(
        analyzed.source === 'text'
          ? { text: analyzed.text, details: notes }
          : { photo: { uri: analyzed.uri, mimeType: 'image/jpeg' }, details: notes },
      );
      if (!alive.current) return;
      setCorrecting(false);
      saving.current = false;
      persist(rechecked, true);
    } catch (caught) {
      if (!alive.current) return;
      const error = caught instanceof AppError ? caught : new AppError('INTERNAL');
      logger.error('analyzeFood', error);
      setCorrecting(false);
      saving.current = false;
      // Nothing was saved: the original verdict and the comment stay so the user can retry.
      toast(error.friendlyMessage);
    }
  };

  const tryAnother = () => {
    checkId.current = null; // an unused check stays stored as a check
    setAnalyzed(null);
    setDraft('');
    setDetails('');
    setCorrection('');
    reset();
  };

  const reviewingPhoto = state.status !== 'done' && !busy && analyzed?.source === 'photo';
  const errorText = notice ?? (state.status === 'error' ? state.error.friendlyMessage : '');
  const errorBanner = errorText ? (
    <View accessibilityRole="alert" style={[styles.error, { backgroundColor: colors.redTint }]}>
      <AppText color="redInk">{errorText}</AppText>
    </View>
  ) : null;

  return (
    <Screen>
      <BackHeader title={copy.title} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {showResult ? (
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
              <View style={styles.correction}>
                <TextField
                  label="Is this right? Tell us more"
                  hint="(optional)"
                  value={correction}
                  onChangeText={setCorrection}
                  placeholder="e.g. it's pumpkin soup, no cream"
                  maxLength={MAX_TEXT}
                  returnKeyType="done"
                />
                <AppText variant="caption" color="inkSoft">
                  {copy.correctionNote}
                </AppText>
              </View>
              <AppText variant="caption" color="inkSoft" style={styles.disclaimer}>
                For tracking only, not medical advice. Food results are AI-generated.
              </AppText>
            </>
          ) : busy ? (
            <FoodLoading
              source={correcting ? 'correction' : preparing ? 'photo' : (analyzed?.source ?? 'text')}
              photoUri={!preparing && analyzed?.source === 'photo' ? analyzed.uri : undefined}
            />
          ) : reviewingPhoto && analyzed?.source === 'photo' ? (
            <>
              <Image
                source={{ uri: analyzed.uri }}
                style={styles.photo}
                contentFit="cover"
                accessibilityLabel="Your meal photo"
              />
              <TextField
                label="Anything we should know?"
                hint="(optional)"
                value={draft}
                onChangeText={setDraft}
                placeholder="e.g. homemade, no chili, oat milk"
                maxLength={MAX_TEXT}
                returnKeyType="done"
                onSubmitEditing={checkPhotoWithDetails}
              />
              {errorBanner}
              <Button
                label={state.status === 'error' ? 'Try again' : 'Check it'}
                onPress={checkPhotoWithDetails}
              />
              <Button label="Choose a different photo" variant="secondary" onPress={tryAnother} />
            </>
          ) : (
            <>
              <AppText color="inkSoft" style={styles.subtitle}>
                {copy.intro}
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
                label={copy.textLabel}
                value={text}
                onChangeText={(value) => {
                  setText(value);
                  setDetails(''); // a correction belongs to the text it was made for
                }}
                placeholder={copy.textPlaceholder}
                maxLength={MAX_TEXT}
                returnKeyType="done"
                onSubmitEditing={checkText}
              />
              {errorBanner}
              <Button
                label={state.status === 'error' && analyzed?.source === 'text' ? 'Try again' : 'Check it'}
                onPress={checkText}
                disabled={!trimmed}
              />
            </>
          )}
        </ScrollView>
        {/* Outside the scroll area so Save is always on screen, however long the result is. */}
        {showResult && (
          <View style={styles.footer}>
            <Button label={copy.saveLabel} onPress={() => void save()} />
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
  correction: { marginTop: space.s2 },
  photo: { width: '100%', height: 200, borderRadius: radius.lg, marginBottom: space.s1 },
  error: { borderRadius: radius.md, padding: space.s2, marginBottom: space.s2 },
});
