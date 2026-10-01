import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Camera, Images, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { FoodLoading } from '@/components/FoodLoading';
import { MealResultCard } from '@/components/MealResultCard';
import { MealTimeSheet, pickTimeAndroid } from '@/components/MealTimeSheet';
import { Screen } from '@/components/Screen';
import { SwipeNav } from '@/components/SwipeNav';
import { TagChip } from '@/components/TagChip';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { useDb } from '@/db/DatabaseProvider';
import {
  createFoodLog,
  createUncheckedMeal,
  promoteCheckToDiary,
  updateFoodCheck,
} from '@/db/repositories/food';
import { createSavedFood, saveCheckedFood, saveFoodFromLog } from '@/db/repositories/savedFoods';
import { useAnalyzeFood } from '@/hooks/useAnalyzeFood';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { foodSwipe } from '@/lib/logSwipe';
import { deletePhoto, savePhoto } from '@/services/photoStore';
import { type AnalysisResult, analyzeFood } from '@/services/relayClient';
import { type PhotoSource, pickFoodPhoto } from '@/services/photoPicker';
import { minTouchTarget, radius, space, typography, useColors } from '@/theme';

const MAX_TEXT = 200;
/** The relay's cap on `details`; the newest words win when earlier notes and a correction overflow it. */
const MAX_DETAILS = 300;
const CAMERA_DENIED =
  'Camera access is off. You can turn it on in Settings, choose a photo instead, or type it in.';

const copy = {
  title: 'Log food',
  textLabel: 'What did you eat?',
  textPlaceholder: 'What did you eat?',
  // A food saved to My foods may not have been eaten yet.
  myFoodTextLabel: "What's the food?",
  analyzeLabel: 'Analyze meal',
  correctionNote: 'Tap Update verdict to re-check it with this.',
  saveLabel: 'I ate this',
  updateLabel: 'Update verdict',
  skipLabel: 'Not now',
  saveUncheckedLabel: 'Save without a verdict',
  savedUnchecked: 'Saved without a verdict',
  saved: 'Added to your food diary',
  savedAndKept: 'Added to your food diary and My foods',
  keepLabel: 'Save to My foods',
  keepOnlyLabel: 'Save to My foods only',
} as const;

/** What was actually sent, so an edit while loading can't mismatch the saved entry. */
type Analyzed = { source: 'text'; text: string } | { source: 'photo'; uri: string };

/** Checking a food for "My foods" instead of the diary: a new one, or (with `id`) one already saved. */
export type MyFoodTarget = { id?: number; name?: string };

/**
 * The one food screen, for a meal just eaten or one being considered: a photo or a typed description →
 * relay analysis → a result card. Each result is kept as a check (outside the diary, so the pet ignores
 * it); "I ate this" promotes that check, reusing its analysis instead of calling the relay again.
 * `openCamera` (the Scan shortcut on Today) opens the camera as soon as the screen appears.
 * With `myFood`, the verdict is saved to "My foods" instead, and nothing goes into the diary.
 * `fromList` ("Log a new food" on the Food list) also offers saving the result to My foods only, and saves a
 * food typed without a verdict to My foods by name.
 */
export function FoodFlow({
  openCamera = false,
  myFood,
  fromList = false,
}: {
  openCamera?: boolean;
  myFood?: MyFoodTarget;
  fromList?: boolean;
}) {
  const colors = useColors();
  const db = useDb();
  const toast = useToast();
  const { state, analyze, reset } = useAnalyzeFood();
  const [text, setText] = useState(myFood?.name ?? '');
  const [analyzed, setAnalyzed] = useState<Analyzed | null>(null);
  // Notes for the AI: `draft` is the photo-review box, `details` what was last sent, `correction` the post-verdict box.
  const [draft, setDraft] = useState('');
  const [details, setDetails] = useState('');
  const [correction, setCorrection] = useState('');
  const [preparing, setPreparing] = useState(false);
  // True while "Update verdict" re-checks the food with the user's comment.
  const [correcting, setCorrecting] = useState(false);
  // A verdict updated from the user's comment; it replaces the first result on screen.
  const [updated, setUpdated] = useState<AnalysisResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Which save is waiting on "When did you eat this?" (the time sheet on iPhone).
  const [askingWhen, setAskingWhen] = useState<'ate' | 'unchecked' | null>(null);
  // "Save to My foods" on the result: also keep the meal for one-tap logging from the Food list.
  const [keep, setKeep] = useState(false);
  const saving = useRef(false);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  // The stored check for the result on screen, and which result it was stored for.
  const checkId = useRef<number | null>(null);
  const checkedResult = useRef<AnalysisResult | null>(null);
  useEffect(() => {
    // A My foods check isn't a meal being considered, so it isn't kept as a check.
    if (state.status !== 'done' || !analyzed || myFood) return;
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
  }, [state, analyzed, db, myFood]);

  // "Log a new food" and My foods checks add to the list; an unchecked save then means "by name", not the diary.
  const addsToList = Boolean(myFood) || fromList;
  const busy = preparing || correcting || state.status === 'loading';
  const shown = state.status === 'done' ? (updated ?? state.result) : null;
  const showResult = shown !== null && !correcting;
  const hasComment = correction.trim() !== '';
  const trimmed = text.trim();

  const run = (target: Analyzed, notes: string) => {
    setNotice(null);
    setUpdated(null);
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

  // Scan on Today: straight to the camera, once. Cancelling it leaves this screen's other options.
  const cameraOpened = useRef(false);
  useEffect(() => {
    if (!openCamera || cameraOpened.current) return;
    cameraOpened.current = true;
    void checkPhoto('camera');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on arrival; checkPhoto's state is fresh then
  }, [openCamera]);

  /**
   * "I ate this" / "Save without a verdict" was tapped: ask when it was eaten first, then save at that time
   * (`null` is now). A My foods check isn't eaten, so it has no time and saves straight away.
   */
  const onSaveUnchecked = () => (addsToList ? saveUnchecked() : askWhen('unchecked'));

  const askWhen = (action: 'ate' | 'unchecked') => {
    const run = action === 'ate' ? save : saveUnchecked;
    if (busy || saving.current) return;
    if (Platform.OS === 'android') pickTimeAndroid(new Date(), run);
    else setAskingWhen(action);
  };

  /** "I ate this" (or "Save to My foods"): saves exactly the verdict on screen, with no further relay call. */
  const save = (eatenAt: Date | null = null) => {
    if (!shown || !analyzed || saving.current) return;
    saving.current = true;
    const { meta, ...analysis } = shown;
    let storedPhoto: string | null = null;
    let savedMessage: string = copy.saved;
    let diaryId: number | null = null;
    try {
      if (myFood) {
        if (analyzed.source === 'photo') storedPhoto = savePhoto(analyzed.uri);
        const saved = saveCheckedFood(db, {
          id: myFood.id,
          source: analyzed.source,
          inputText: analyzed.source === 'text' ? analyzed.text : null,
          photoUri: storedPhoto,
          analysis,
          meta,
        });
        savedMessage = saved.created
          ? `${saved.mealName} added to My foods`
          : `Updated ${saved.mealName} in My foods`;
      } else if (checkId.current !== null) {
        promoteCheckToDiary(db, checkId.current, eatenAt?.toISOString());
        diaryId = checkId.current;
      } else {
        if (analyzed.source === 'photo') storedPhoto = savePhoto(analyzed.uri);
        diaryId = createFoodLog(db, {
          entryType: 'diary',
          source: analyzed.source,
          inputText: analyzed.source === 'text' ? analyzed.text : null,
          photoUri: storedPhoto,
          analysis,
          meta,
          loggedAt: eatenAt?.toISOString(),
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
    if (keep && diaryId !== null) {
      try {
        saveFoodFromLog(db, diaryId);
        savedMessage = copy.savedAndKept;
      } catch {
        // Code only. Not fatal: the meal is in the diary, and can be saved from Your Logs later.
        logger.error('saveFoodFromLog', new AppError('INTERNAL'));
      }
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast(savedMessage);
    router.back();
  };

  /** "Save to My foods only" (from the Food list): keeps the verdict for one-tap logging, without eating it now. */
  const saveOnly = () => {
    if (!shown || !analyzed || saving.current) return;
    saving.current = true;
    const { meta, ...analysis } = shown;
    let storedPhoto: string | null = null;
    let saved: { created: boolean; mealName: string };
    try {
      if (analyzed.source === 'photo') storedPhoto = savePhoto(analyzed.uri);
      saved = saveCheckedFood(db, {
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
      logger.error('saveCheckedFood', new AppError('INTERNAL'));
      toast("We couldn't save that. Please try again.");
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast(saved.created ? `${saved.mealName} added to My foods` : `Updated ${saved.mealName} in My foods`);
    router.back();
  };

  /** Saves what was typed or photographed as a plain diary entry, with no relay call (works offline). */
  const saveUnchecked = (eatenAt: Date | null = null) => {
    const target: Analyzed | null =
      analyzed?.source === 'photo' ? analyzed : trimmed ? { source: 'text', text: trimmed } : null;
    if (!target || busy || saving.current) return;
    saving.current = true;
    let storedPhoto: string | null = null;
    try {
      if (addsToList) {
        // Only offered for a new food described in words: it is added by name, like before.
        if (target.source === 'text') createSavedFood(db, target.text);
      } else {
        if (target.source === 'photo') storedPhoto = savePhoto(target.uri);
        createUncheckedMeal(db, {
          source: target.source,
          inputText: target.source === 'text' ? target.text : null,
          photoUri: storedPhoto,
          loggedAt: eatenAt?.toISOString(),
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
    toast(addsToList && target.source === 'text' ? `${target.text} added to My foods` : copy.savedUnchecked);
    router.back();
  };

  /**
   * "Update verdict": the AI re-checks the food with the user's comment and the new verdict is shown
   * (and stored on the check) before anything goes into the diary. Comments build on each other.
   */
  const updateVerdict = async () => {
    const note = correction.trim();
    if (!shown || !analyzed || !note || saving.current) return;
    saving.current = true;
    setCorrecting(true);
    const notes = [details, note].filter(Boolean).join('. ').slice(-MAX_DETAILS);
    try {
      const result = await analyzeFood(
        analyzed.source === 'text'
          ? { text: analyzed.text, details: notes }
          : { photo: { uri: analyzed.uri, mimeType: 'image/jpeg' }, details: notes },
      );
      if (!alive.current) return;
      if (checkId.current !== null) {
        const { meta, ...analysis } = result;
        try {
          updateFoodCheck(db, checkId.current, { analysis, meta });
        } catch {
          // Code only. "I ate this" then writes the diary entry straight from the verdict on screen.
          logger.error('saveFoodCheck', new AppError('INTERNAL'));
          checkId.current = null;
        }
      }
      setUpdated(result);
      setDetails(notes);
      setCorrection('');
      toast('Verdict updated');
    } catch (caught) {
      if (!alive.current) return;
      const error = caught instanceof AppError ? caught : new AppError('INTERNAL');
      logger.error('analyzeFood', error);
      // The current verdict and the comment stay so the user can retry.
      toast(error.friendlyMessage);
    } finally {
      saving.current = false;
      if (alive.current) setCorrecting(false);
    }
  };

  const tryAnother = () => {
    checkId.current = null; // an unused check stays stored as a check
    setKeep(false);
    setUpdated(null);
    setAnalyzed(null);
    setDraft('');
    setDetails('');
    setCorrection('');
    reset();
  };

  // Unchecked saves go to the diary; for My foods only a new food typed by name can skip the verdict.
  const canSaveUnchecked = !myFood || myFood.id === undefined;
  const reviewingPhoto = state.status !== 'done' && !busy && analyzed?.source === 'photo';
  const errorText = notice ?? (state.status === 'error' ? state.error.friendlyMessage : '');
  const errorBanner = errorText ? (
    <View accessibilityRole="alert" style={[styles.error, { backgroundColor: colors.redTint }]}>
      <AppText color="redInk">{errorText}</AppText>
    </View>
  ) : null;

  // The plain Food screen (nothing saved yet) joins the swipe between log screens, but only while it
  // is empty, so a stray drag can't drop a typed description or a photo.
  const swipeable = !myFood && !fromList && !openCamera && !analyzed && !text && !draft && !busy;

  return (
    <SwipeNav {...foodSwipe} enabled={swipeable}>
      <Screen>
        <BackHeader
          title={myFood ? (myFood.id === undefined ? 'Add a food' : 'Get a verdict') : copy.title}
        />
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
                {shown && <MealResultCard analysis={shown} />}
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
                {!myFood && (
                  <View style={styles.keep}>
                    <TagChip label={copy.keepLabel} selected={keep} onPress={() => setKeep((on) => !on)} />
                  </View>
                )}
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
                <View style={styles.actions}>
                  <Button
                    label={state.status === 'error' ? 'Try again' : copy.analyzeLabel}
                    onPress={checkPhotoWithDetails}
                  />
                  {!addsToList && (
                    <Button label={copy.saveUncheckedLabel} variant="secondary" onPress={onSaveUnchecked} />
                  )}
                  <Button label="Choose a different photo" variant="secondary" onPress={tryAnother} />
                </View>
              </>
            ) : (
              <>
                <TextField
                  label={addsToList ? copy.myFoodTextLabel : copy.textLabel}
                  hideLabel
                  accessory={
                    <>
                      <IconButton
                        label="Take a photo"
                        icon={Camera}
                        onPress={() => void checkPhoto('camera')}
                      />
                      <IconButton
                        label="Choose a photo"
                        icon={Images}
                        onPress={() => void checkPhoto('library')}
                      />
                    </>
                  }
                  value={text}
                  onChangeText={(value) => {
                    setText(value);
                    setDetails(''); // a correction belongs to the text it was made for
                  }}
                  placeholder={addsToList ? copy.myFoodTextLabel : copy.textPlaceholder}
                  maxLength={MAX_TEXT}
                  returnKeyType="done"
                  onSubmitEditing={checkText}
                />
                {errorBanner}
                {/* Only once something is typed, so an empty screen has one clear place to start. */}
                {trimmed !== '' && (
                  <View style={styles.actions}>
                    <Button
                      label={
                        state.status === 'error' && analyzed?.source === 'text'
                          ? 'Try again'
                          : copy.analyzeLabel
                      }
                      onPress={checkText}
                    />
                    {/* A quiet link: it's the fallback (offline, or no verdict wanted), not the main action. */}
                    {canSaveUnchecked && (
                      <Pressable accessibilityRole="button" onPress={onSaveUnchecked} style={styles.link}>
                        <AppText style={[styles.linkText, { color: colors.clayInk }]}>
                          {copy.saveUncheckedLabel}
                        </AppText>
                      </Pressable>
                    )}
                  </View>
                )}
              </>
            )}
          </ScrollView>
          {/* Outside the scroll area so Save is always on screen, however long the result is. */}
          {showResult && (
            <View style={styles.footer}>
              {/* A comment turns the main button into "Update verdict", so what gets saved is always what's shown. */}
              {hasComment ? (
                <Button label={copy.updateLabel} onPress={() => void updateVerdict()} />
              ) : (
                <Button
                  label={myFood ? 'Save to My foods' : copy.saveLabel}
                  onPress={() => (myFood ? save() : askWhen('ate'))}
                />
              )}
              {/* The check stays stored, outside the diary (a My foods check saves nothing). "Save to My foods
                only" waits for a comment's update, for the same reason as the main button. */}
              {fromList && !hasComment ? (
                <Button label={copy.keepOnlyLabel} variant="secondary" onPress={saveOnly} />
              ) : (
                <Button label={copy.skipLabel} variant="secondary" onPress={() => router.back()} />
              )}
            </View>
          )}
        </KeyboardAvoidingView>
        <MealTimeSheet
          visible={askingWhen !== null}
          question="When did you eat this?"
          confirmLabel="Save"
          onConfirm={(at) => {
            const action = askingWhen;
            setAskingWhen(null);
            if (action === 'ate') save(at);
            else if (action === 'unchecked') saveUnchecked(at);
          }}
          onClose={() => setAskingWhen(null)}
        />
      </Screen>
    </SwipeNav>
  );
}

/** A photo action inside the food input: just the icon, with the full name for screen readers. */
function IconButton({
  label,
  icon: Icon,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}>
      <Icon size={22} color={colors.clayInk} strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: space.s3 },
  disclaimer: { textAlign: 'center', marginVertical: space.s1 },
  keep: { flexDirection: 'row', marginTop: space.s2 },
  iconButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: space.s1 },
  footer: { gap: space.s1, paddingTop: space.s1 },
  correction: { marginTop: space.s2 },
  link: { minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  linkText: { ...typography.bodyEm, fontSize: 15, fontFamily: 'Nunito_700Bold' },
  photo: { width: '100%', height: 200, borderRadius: radius.lg, marginBottom: space.s1 },
  error: { borderRadius: radius.md, padding: space.s2, marginBottom: space.s2 },
});
