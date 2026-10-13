import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { CheckboxRow } from '@/components/CheckboxRow';
import { FoodLoading } from '@/components/FoodLoading';
import { FoodCapture } from '@/components/food/FoodCapture';
import { FoodVerdict } from '@/components/food/FoodVerdict';
import { QuickLogRow } from '@/components/food/QuickLogRow';
import { Screen } from '@/components/Screen';
import { SwipeNav } from '@/components/SwipeNav';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { analysisConditions } from '@/constants/conditions';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import {
  createFoodLog,
  createUncheckedMeal,
  promoteCheckToDiary,
  updateFoodCheck,
} from '@/db/repositories/food';
import {
  createSavedFood,
  listSavedFoods,
  logSavedFood,
  saveCheckedFood,
  saveFoodFromLog,
  type StoredSavedFood,
} from '@/db/repositories/savedFoods';
import { getSetting } from '@/db/repositories/settings';
import { useAnalyzeFood } from '@/hooks/useAnalyzeFood';
import { playChing } from '@/lib/ching';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { foodSwipe } from '@/lib/logSwipe';
import { dayToLoggedAt, formatMealTime } from '@/lib/mealTime';
import { isLateMeal } from '@/lib/mealTiming';
import { currentTimeZone } from '@/lib/time';
import { deletePhoto, savePhoto } from '@/services/photoStore';
import { type AnalysisResult, analyzeFood } from '@/services/relayClient';
import { type PhotoSource, pickFoodPhoto } from '@/services/photoPicker';
import { fontFamily, minTouchTarget, radius, space, typography, useColors } from '@/theme';

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
  analyzeLabel: 'Check this meal',
  saveLabel: 'I ate this',
  updateLabel: 'Update verdict',
  saveUncheckedLabel: 'Log without checking',
  savedUnchecked: 'Saved without a verdict',
  saved: 'Added to your food diary',
  savedAndKept: 'Added to your food diary and My foods',
  keepOnlyLabel: 'Save to My foods only',
  notEatingLabel: 'Not eating this',
} as const;

/** What was actually sent, so an edit while loading can't mismatch the saved entry. */
type Analyzed = { source: 'text'; text: string } | { source: 'photo'; uri: string };

/** Checking a food for "My foods" instead of the diary: a new one, or (with `id`) one already saved. */
export type MyFoodTarget = { id?: number; name?: string };

/**
 * The one food screen, for a meal just eaten or one being considered, in two steps (Figma 03b and 03c):
 * capture (a photo or a typed description) → verdict (the belly's mood, why, matched triggers). Saved foods
 * sit on top of the capture step as a Quick log row; tapping one logs it straight away with its saved
 * verdict. Each result is kept as a check (outside the diary); "I ate this" promotes that check, reusing its
 * analysis instead of calling the relay again, and the meal is logged: a toast, then back to Today. Portion,
 * lifestyle tags and a note are added later by editing the entry.
 * `photoUri` is a photo the tab bar's Snap food already took and prepared: the flow starts on its review step.
 * `openCamera` opens the camera as soon as the screen appears (the tab bar falls back to it when it was denied camera
 * access, so this screen can say why).
 * With `myFood`, the verdict is saved to "My foods" instead, and nothing goes into the diary.
 * `fromList` ("Log a new food" on the Food list) also offers saving the result to My foods only; saving
 * without a verdict still logs the meal to the diary.
 * `date` (a day tapped in Today's week strip) logs the meal at noon of that earlier day instead of now.
 */
export function FoodFlow({
  photoUri,
  openCamera = false,
  myFood,
  fromList = false,
  date,
}: {
  photoUri?: string;
  openCamera?: boolean;
  myFood?: MyFoodTarget;
  fromList?: boolean;
  date?: string;
}) {
  const colors = useColors();
  const db = useDb();
  const toast = useToast();
  const { state, analyze, reset } = useAnalyzeFood();
  const [text, setText] = useState(myFood?.name ?? '');
  const [analyzed, setAnalyzed] = useState<Analyzed | null>(
    photoUri ? { source: 'photo', uri: photoUri } : null,
  );
  // Notes for the AI: `draft` is the photo-review box, `aiNotes` what was last sent, `correction` the post-verdict box.
  const [draft, setDraft] = useState('');
  const [aiNotes, setAiNotes] = useState('');
  const [correction, setCorrection] = useState('');
  const [preparing, setPreparing] = useState(false);
  // True while "Update verdict" re-checks the food with the user's comment.
  const [correcting, setCorrecting] = useState(false);
  // A verdict updated from the user's comment; it replaces the first result on screen.
  const [updated, setUpdated] = useState<AnalysisResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { settings } = useSettings();
  // The Quick log row is for logging what was eaten, so My foods and the Food list's own check leave it out.
  // Reloaded on focus, so foods edited or removed under "See all" are right when coming back.
  const [savedFoods, setSavedFoods] = useState<StoredSavedFood[]>([]);
  const loadSavedFoods = useCallback(() => {
    if (myFood || fromList) return;
    try {
      setSavedFoods(listSavedFoods(db));
    } catch {
      setSavedFoods([]); // the check still works without the row
    }
  }, [db, myFood, fromList]);
  useFocusEffect(loadSavedFoods);
  /** When a meal logged straight away counts as eaten: now, or noon of the day picked in the week strip. */
  const logTime = () => (date ? dayToLoggedAt(date, new Date()) : null) ?? new Date();
  // "Also save to My foods", ticked on the verdict before the meal is logged.
  const [keep, setKeep] = useState(false);
  const [choosingPhoto, setChoosingPhoto] = useState(false);
  // The picker opens only once the sheet has finished closing: iOS can't present it over a closing modal.
  const pendingPhoto = useRef<PhotoSource | null>(null);
  const [telling, setTelling] = useState(false);
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
      // Code only. Not fatal: Save then writes the diary entry straight from the result.
      logger.error('saveFoodCheck', new AppError('INTERNAL'));
    }
  }, [state, analyzed, db, myFood]);

  // My foods checks add to the list; an unchecked save then means "by name", not the diary.
  const addsToList = Boolean(myFood);
  const foodListMode = addsToList || fromList;
  const busy = preparing || correcting || state.status === 'loading';
  const shown = state.status === 'done' ? (updated ?? state.result) : null;
  const showResult = shown !== null && !correcting;
  const hasComment = correction.trim() !== '';
  const trimmed = text.trim();

  const run = (target: Analyzed, notes: string) => {
    setNotice(null);
    setUpdated(null);
    setAnalyzed(target);
    setAiNotes(notes);
    const extra = {
      ...(notes ? { details: notes } : {}),
      ...analysisConditions(getSetting(db, 'conditions')),
    };
    void analyze(
      target.source === 'text'
        ? { text: target.text, ...extra }
        : { photo: { uri: target.uri, mimeType: 'image/jpeg' }, ...extra },
    );
  };

  const checkText = () => {
    if (!trimmed || busy) return;
    run({ source: 'text', text: trimmed }, aiNotes);
  };

  const checkPhotoWithDetails = () => {
    if (busy || analyzed?.source !== 'photo') return;
    run(analyzed, draft.trim());
  };

  const checkPhoto = async (source: PhotoSource, fromScan = false) => {
    if (busy) return;
    setNotice(null);
    try {
      const picked = await pickFoodPhoto(source, () => {
        if (alive.current) setPreparing(true);
      });
      if (!alive.current) return;
      if (picked.status === 'denied') setNotice(CAMERA_DENIED);
      // Closing the camera that `openCamera` opened means "never mind": back to where the user came from.
      if (picked.status === 'canceled' && fromScan) router.back();
      if (picked.status !== 'ok') return;
      // Not analyzed yet: the review step lets the user add optional details first.
      setAnalyzed({ source: 'photo', uri: picked.photo.uri });
      setDraft('');
      setAiNotes('');
      reset();
    } catch {
      // Code only: the picker or manipulator error could carry file paths.
      logger.error('preparePhoto', new AppError('INPUT_REJECTED'));
      if (alive.current) setNotice(new AppError('INPUT_REJECTED').friendlyMessage);
    } finally {
      if (alive.current) setPreparing(false);
    }
  };

  // `openCamera`: straight to the camera, once. Closing it goes back; denied access keeps the screen and says why.
  const cameraOpened = useRef(false);
  useEffect(() => {
    if (!openCamera || cameraOpened.current) return;
    cameraOpened.current = true;
    void checkPhoto('camera', true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on arrival; checkPhoto's state is fresh then
  }, [openCamera]);

  /** A meal was just logged: the nudge and the toast, then back to Today. */
  const mealLogged = (message: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playChing();
    toast(message, { top: true });
    router.dismissTo('/');
  };

  /**
   * "I ate this" (or "Save to My foods" for a My foods check): logs exactly the verdict on screen, with no
   * further relay call. A diary meal is logged right away, as of now, then the app goes back to Today.
   */
  const save = () => {
    if (!shown || !analyzed || saving.current) return;
    saving.current = true;
    const { meta, ...analysis } = shown;
    const at = logTime();
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
        promoteCheckToDiary(db, checkId.current, at.toISOString());
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
          loggedAt: at.toISOString(),
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
    if (diaryId !== null) {
      if (keep) {
        try {
          saveFoodFromLog(db, diaryId);
          savedMessage = copy.savedAndKept;
        } catch {
          // Code only. Not fatal: the meal is in the diary, and can be saved from Your Logs later.
          logger.error('saveFoodFromLog', new AppError('INTERNAL'));
        }
      }
      mealLogged(savedMessage);
      return;
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

  /**
   * "Log without checking": what was typed becomes a plain diary entry, with no relay call (works offline).
   * For My foods it is added by name instead, which has no time.
   */
  const saveUnchecked = () => {
    if (!trimmed || busy || saving.current) return;
    saving.current = true;
    const at = logTime();
    let mealId: number | null = null;
    try {
      if (addsToList) createSavedFood(db, trimmed);
      else
        mealId = createUncheckedMeal(db, {
          source: 'text',
          inputText: trimmed,
          loggedAt: at.toISOString(),
        });
    } catch {
      saving.current = false;
      // Code only: a raw error could echo the food text.
      logger.error('saveFoodLog', new AppError('INTERNAL'));
      toast("We couldn't save that. Please try again.");
      return;
    }
    if (mealId === null) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast(`${trimmed} added to My foods`);
      router.back();
      return;
    }
    mealLogged(copy.savedUnchecked);
  };

  /** A Quick log chip: logs the food with the verdict it was saved with (no relay call). */
  const logQuick = (food: StoredSavedFood) => {
    if (busy || saving.current) return;
    saving.current = true;
    const at = logTime();
    try {
      logSavedFood(db, food.id, at.toISOString());
    } catch {
      saving.current = false;
      // Code only: a raw error could echo the food name.
      logger.error('logSavedFood', new AppError('INTERNAL'));
      toast("We couldn't save that. Please try again.");
      return;
    }
    mealLogged(copy.saved);
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
    const notes = [aiNotes, note].filter(Boolean).join('. ').slice(-MAX_DETAILS);
    const conditions = analysisConditions(getSetting(db, 'conditions'));
    try {
      const result = await analyzeFood(
        analyzed.source === 'text'
          ? { text: analyzed.text, details: notes, ...conditions }
          : { photo: { uri: analyzed.uri, mimeType: 'image/jpeg' }, details: notes, ...conditions },
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
      setAiNotes(notes);
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

  /** "Update verdict" or the keyboard's Done: closes the sheet and re-checks with the comment. */
  const submitCorrection = () => {
    if (!hasComment) return;
    setTelling(false);
    void updateVerdict();
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

  const now = new Date();
  // The verdict is about the meal as it will be logged: now, or noon of the picked day.
  const mealAt = logTime();
  const verdictLate =
    shown !== null &&
    isLateMeal(mealAt.toISOString(), currentTimeZone(), settings.bedtime, settings.lateMealWindowMinutes);
  // Back walks the steps: verdict → capture, then leaves.
  const backToCapture = () => {
    setCorrection('');
    setUpdated(null);
    reset();
  };
  const onBack = showResult ? backToCapture : undefined;
  const typed = trimmed.toLowerCase();
  const quickFoods = savedFoods
    .filter((food) => !typed || food.mealName.toLowerCase().includes(typed))
    .map((food) => ({ id: food.id, name: food.mealName }));

  let body;
  if (showResult && shown) {
    body = (
      <>
        <FoodVerdict analysis={shown} when={formatMealTime(mealAt, now)} late={verdictLate} />
        {/* Ticked before "I ate this", which logs the meal straight away. */}
        {!myFood && !fromList && (
          <View style={styles.keep}>
            <CheckboxRow
              label="Also save to My foods"
              checked={keep}
              onToggle={() => setKeep((current) => !current)}
            />
          </View>
        )}
      </>
    );
  } else if (busy) {
    body = (
      <FoodLoading
        source={correcting ? 'correction' : preparing ? 'photo' : (analyzed?.source ?? 'text')}
        photoUri={!preparing && analyzed?.source === 'photo' ? analyzed.uri : undefined}
      />
    );
  } else if (reviewingPhoto && analyzed?.source === 'photo') {
    body = (
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
        </View>
      </>
    );
  } else {
    body = (
      <FoodCapture
        heading={foodListMode ? copy.myFoodTextLabel : copy.textLabel}
        fieldLabel="Describe it"
        placeholder="e.g. Oatmeal with banana"
        text={text}
        onChangeText={(value) => {
          setText(value);
          setAiNotes(''); // a correction belongs to the text it was made for
        }}
        onSubmit={checkText}
        onPickPhoto={() => setChoosingPhoto(true)}
        maxLength={MAX_TEXT}
        notice={errorBanner}
        quickLog={
          quickFoods.length > 0 ? (
            <QuickLogRow
              foods={quickFoods}
              onPick={(id) => {
                const food = savedFoods.find((item) => item.id === id);
                if (food) logQuick(food);
              }}
              onSeeAll={() => router.push({ pathname: '/log/food', params: { manage: '1' } })}
            />
          ) : undefined
        }
      />
    );
  }

  // Outside the scroll area so the main button is always on screen, however long the step is.
  let footer = null;
  if (showResult) {
    footer = (
      <View style={styles.footer}>
        <Button label={myFood ? 'Save to My foods' : copy.saveLabel} onPress={save} />
        <Button label="Not quite right? Tell us more" variant="secondary" onPress={() => setTelling(true)} />
        {/* Quiet links, for someone only checking a food. The Food list's own check keeps it instead. */}
        {fromList && (
          <Pressable accessibilityRole="button" onPress={saveOnly} style={styles.link}>
            <AppText style={[styles.linkText, { color: colors.clayInk }]}>{copy.keepOnlyLabel}</AppText>
          </Pressable>
        )}
        {!fromList && !myFood && (
          <Pressable
            accessibilityRole="button"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={styles.link}>
            <AppText style={[styles.linkText, { color: colors.clayInk }]}>{copy.notEatingLabel}</AppText>
          </Pressable>
        )}
      </View>
    );
  } else if (!busy && !reviewingPhoto) {
    footer = (
      <View style={styles.footer}>
        <Button
          label={state.status === 'error' && analyzed?.source === 'text' ? 'Try again' : copy.analyzeLabel}
          onPress={checkText}
          disabled={trimmed === ''}
        />
        {/* A quiet link: it's the fallback (offline, or no verdict wanted), not the main action. */}
        {trimmed !== '' && canSaveUnchecked && (
          <Pressable accessibilityRole="button" onPress={saveUnchecked} style={styles.link}>
            <AppText style={[styles.linkText, { color: colors.clayInk }]}>{copy.saveUncheckedLabel}</AppText>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <SwipeNav {...foodSwipe} enabled={swipeable}>
      <Screen>
        <BackHeader
          title={myFood ? (myFood.id === undefined ? 'Add a food' : 'Get a verdict') : undefined}
          onBack={onBack}
        />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            // A fresh scroll position for each step.
            key={showResult ? 'verdict' : busy ? 'busy' : 'capture'}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}>
            {body}
          </ScrollView>
          {footer}
        </KeyboardAvoidingView>
        <BottomSheet
          visible={choosingPhoto}
          onClose={() => setChoosingPhoto(false)}
          onDismissed={() => {
            const source = pendingPhoto.current;
            pendingPhoto.current = null;
            if (source) void checkPhoto(source);
          }}>
          <AppText variant="title" accessibilityRole="header">
            Add a photo
          </AppText>
          <View style={styles.sheetActions}>
            <Button
              label="Take a photo"
              onPress={() => {
                pendingPhoto.current = 'camera';
                setChoosingPhoto(false);
              }}
            />
            <Button
              label="Choose a photo"
              variant="secondary"
              onPress={() => {
                pendingPhoto.current = 'library';
                setChoosingPhoto(false);
              }}
            />
          </View>
        </BottomSheet>
        <BottomSheet visible={telling} onClose={() => setTelling(false)}>
          <AppText variant="title" accessibilityRole="header">
            Not quite right?
          </AppText>
          <View style={styles.sheetActions}>
            <TextField
              label="Tell us more"
              hint="(optional)"
              value={correction}
              onChangeText={setCorrection}
              placeholder="e.g. it's pumpkin soup, no cream"
              maxLength={MAX_TEXT}
              returnKeyType="done"
              onSubmitEditing={submitCorrection}
            />
            <Button label={copy.updateLabel} disabled={!hasComment} onPress={submitCorrection} />
          </View>
        </BottomSheet>
      </Screen>
    </SwipeNav>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: space.s3 },
  actions: { gap: space.s1 },
  footer: { gap: 12, paddingTop: space.s2 },
  keep: { marginTop: space.s1 },
  sheetActions: { gap: space.s2, marginTop: space.s2 },
  link: { minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  linkText: { ...typography.bodyEm, fontSize: 15, fontFamily: fontFamily.bold },
  photo: { width: '100%', height: 200, borderRadius: radius.lg, marginBottom: space.s1 },
  error: { borderRadius: radius.md, padding: space.s2 },
});
