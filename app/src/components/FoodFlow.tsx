import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { FoodLoading } from '@/components/FoodLoading';
import { FoodCapture } from '@/components/food/FoodCapture';
import { FoodDetails, type MealDetailsState } from '@/components/food/FoodDetails';
import { FoodVerdict } from '@/components/food/FoodVerdict';
import { QuickLogRow } from '@/components/food/QuickLogRow';
import { MealTimeSheet, pickTimeAndroid } from '@/components/MealTimeSheet';
import { Screen } from '@/components/Screen';
import { SwipeNav } from '@/components/SwipeNav';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import {
  createFoodLog,
  createUncheckedMeal,
  promoteCheckToDiary,
  saveMealDetails,
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
import { createSymptomLog } from '@/db/repositories/symptoms';
import { useAnalyzeFood } from '@/hooks/useAnalyzeFood';
import { playChing } from '@/lib/ching';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { foodSwipe } from '@/lib/logSwipe';
import { formatMealTime } from '@/lib/mealTime';
import { isLateMeal } from '@/lib/mealTiming';
import { currentTimeZone } from '@/lib/time';
import { effectiveVerdict } from '@/lib/verdict';
import { deletePhoto, savePhoto } from '@/services/photoStore';
import { type AnalysisResult, analyzeFood } from '@/services/relayClient';
import { type PhotoSource, pickFoodPhoto } from '@/services/photoPicker';
import { fontFamily, minTouchTarget, radius, space, typography, useColors } from '@/theme';

const MAX_TEXT = 200;
const MAX_NOTE = 500;
const EXTRAS_FAILED = "Saved, but we couldn't keep the extras";
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
 * The one food screen, for a meal just eaten or one being considered, in three steps (Figma 03b to 03d):
 * capture (a photo or a typed description) → verdict (the belly's mood, why, matched triggers) → details
 * (time, portion, lifestyle tags, symptoms, a note). Saved foods sit on top of the capture step as a Quick
 * log row; tapping one skips straight to the details with its saved verdict. Each result is kept as a check (outside the diary);
 * "I ate this" opens the details, and Save promotes that check, reusing its analysis instead of calling
 * the relay again.
 * `openCamera` (the Scan shortcut on Today) opens the camera as soon as the screen appears.
 * With `myFood`, the verdict is saved to "My foods" instead, and nothing goes into the diary.
 * `fromList` ("Log a new food" on the Food list) also offers saving the result to My foods only; saving
 * without a verdict still logs the meal to the diary.
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
  // The details step: which kind of save it is for (a checked meal, or one saved without a verdict).
  const [detailsFor, setDetailsFor] = useState<'verdict' | 'unchecked' | 'saved' | null>(null);
  // The saved food tapped in the Quick log row, while its details are open.
  const [quickFood, setQuickFood] = useState<StoredSavedFood | null>(null);
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
  const [eatenAt, setEatenAt] = useState(() => new Date());
  const [details, setDetails] = useState<MealDetailsState>({
    portion: 'regular',
    tags: new Set(),
    symptoms: new Set(),
    note: '',
    keep: false,
  });
  const [pickingTime, setPickingTime] = useState(false);
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
    const extra = notes ? { details: notes } : {};
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
      // Closing the camera that Scan opened means "never mind": back to where the user came from.
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

  // Scan on Today: straight to the camera, once. Closing it goes back; denied access keeps the screen and says why.
  const cameraOpened = useRef(false);
  useEffect(() => {
    if (!openCamera || cameraOpened.current) return;
    cameraOpened.current = true;
    void checkPhoto('camera', true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on arrival; checkPhoto's state is fresh then
  }, [openCamera]);

  /** "I ate this" / "Log without checking" / a Quick log food: on to the details (time, portion, extras), where Save is. */
  const openDetails = (kind: 'verdict' | 'unchecked' | 'saved') => {
    if (busy || saving.current) return;
    setEatenAt(new Date());
    setDetailsFor(kind);
  };

  const pickTime = () => {
    if (Platform.OS === 'android') pickTimeAndroid(eatenAt, setEatenAt);
    else setPickingTime(true);
  };

  /**
   * The extras from the details step, written after the meal itself: the portion, lifestyle tags and note on
   * the meal, and any symptoms as a symptom log linked to it. Not fatal: the meal is already saved.
   */
  const writeExtras = (mealId: number): boolean => {
    try {
      saveMealDetails(db, mealId, {
        portion: details.portion,
        tags: [...details.tags],
        notes: details.note,
      });
      if (details.symptoms.size > 0) {
        createSymptomLog(db, {
          items: [...details.symptoms].map((key) => ({ key })),
          foodLogId: mealId,
          loggedAt: eatenAt.toISOString(),
        });
      }
    } catch {
      // Code only: a raw error could echo the note.
      logger.error('saveMealDetails', new AppError('INTERNAL'));
      return false;
    }
    return true;
  };

  /** After a diary save: a nudge, the toast, and back to Today. */
  const finishDiary = (message: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playChing();
    toast(message);
    router.dismissTo('/');
  };

  /** "Save" on the details (or "Save to My foods" for a My foods check): saves exactly the verdict on screen, with no further relay call. */
  const save = () => {
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
        promoteCheckToDiary(db, checkId.current, eatenAt.toISOString());
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
          loggedAt: eatenAt.toISOString(),
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
      const extrasKept = writeExtras(diaryId);
      if (details.keep) {
        try {
          saveFoodFromLog(db, diaryId);
          if (extrasKept) savedMessage = copy.savedAndKept;
        } catch {
          // Code only. Not fatal: the meal is in the diary, and can be saved from Your Logs later.
          logger.error('saveFoodFromLog', new AppError('INTERNAL'));
        }
      }
      finishDiary(extrasKept ? savedMessage : EXTRAS_FAILED);
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
   * Saves what was typed as a plain diary entry, with no relay call (works offline). For My foods it is
   * added by name instead, which has no time or details.
   */
  const saveUnchecked = () => {
    if (!trimmed || busy || saving.current) return;
    saving.current = true;
    let mealId: number | null = null;
    try {
      if (addsToList) createSavedFood(db, trimmed);
      else
        mealId = createUncheckedMeal(db, {
          source: 'text',
          inputText: trimmed,
          portion: details.portion,
          loggedAt: eatenAt.toISOString(),
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
    finishDiary(writeExtras(mealId) ? copy.savedUnchecked : EXTRAS_FAILED);
  };

  /** Save on the details of a Quick log food: logs it with the verdict it was saved with, no relay call. */
  const saveSaved = () => {
    if (!quickFood || saving.current) return;
    saving.current = true;
    let mealId: number;
    try {
      mealId = logSavedFood(db, quickFood.id, eatenAt.toISOString());
    } catch {
      saving.current = false;
      // Code only: a raw error could echo the food name.
      logger.error('logSavedFood', new AppError('INTERNAL'));
      toast("We couldn't save that. Please try again.");
      return;
    }
    finishDiary(writeExtras(mealId) ? copy.saved : EXTRAS_FAILED);
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
  const swipeable =
    !myFood && !fromList && !openCamera && !analyzed && !text && !draft && !busy && detailsFor === null;

  const now = new Date();
  const verdictLate =
    shown !== null &&
    isLateMeal(now.toISOString(), currentTimeZone(), settings.bedtime, settings.lateMealWindowMinutes);
  // Back walks the steps: details → verdict → capture, then leaves.
  const backToCapture = () => {
    setCorrection('');
    setUpdated(null);
    reset();
  };
  const leaveDetails = () => {
    setDetailsFor(null);
    setQuickFood(null);
  };
  const onBack = detailsFor ? leaveDetails : showResult ? backToCapture : undefined;
  const onDetails = detailsFor !== null;
  const detailsVerdict =
    detailsFor === 'verdict' && shown
      ? effectiveVerdict(shown)
      : detailsFor === 'saved' && quickFood?.analysis
        ? effectiveVerdict(quickFood.analysis)
        : undefined;
  const detailsName =
    detailsFor === 'verdict' && shown
      ? shown.mealName
      : detailsFor === 'saved'
        ? (quickFood?.mealName ?? '')
        : trimmed;
  const typed = trimmed.toLowerCase();
  const quickFoods = savedFoods
    .filter((food) => !typed || food.mealName.toLowerCase().includes(typed))
    .map((food) => ({ id: food.id, name: food.mealName }));

  let body;
  if (onDetails) {
    body = (
      <FoodDetails
        mealName={detailsName}
        verdict={detailsVerdict}
        whenLabel={formatMealTime(eatenAt, now)}
        onPickTime={pickTime}
        state={details}
        onChange={setDetails}
        showKeep={detailsFor === 'verdict' && !myFood && !fromList}
        maxNote={MAX_NOTE}
      />
    );
  } else if (showResult && shown) {
    body = <FoodVerdict analysis={shown} when={formatMealTime(now, now)} late={verdictLate} />;
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
                if (!food) return;
                setQuickFood(food);
                openDetails('saved');
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
  if (onDetails) {
    footer = (
      <View style={styles.footer}>
        <Button
          label="Save"
          onPress={detailsFor === 'verdict' ? save : detailsFor === 'saved' ? saveSaved : saveUnchecked}
        />
      </View>
    );
  } else if (showResult) {
    footer = (
      <View style={styles.footer}>
        <Button
          label={myFood ? 'Save to My foods' : copy.saveLabel}
          onPress={() => (myFood ? save() : openDetails('verdict'))}
        />
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
          <Pressable
            accessibilityRole="button"
            onPress={() => (addsToList ? saveUnchecked() : openDetails('unchecked'))}
            style={styles.link}>
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
            // A fresh scroll position for each step, so details don't open scrolled down from the verdict.
            key={detailsFor ?? (showResult ? 'verdict' : busy ? 'busy' : 'capture')}
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
            />
            <Button
              label={copy.updateLabel}
              disabled={!hasComment}
              onPress={() => {
                setTelling(false);
                void updateVerdict();
              }}
            />
          </View>
        </BottomSheet>
        <MealTimeSheet
          visible={pickingTime}
          question="When did you eat this?"
          confirmLabel="Done"
          onConfirm={(at) => {
            setPickingTime(false);
            setEatenAt(at ?? new Date());
          }}
          onClose={() => setPickingTime(false)}
        />
      </Screen>
    </SwipeNav>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: space.s3 },
  actions: { gap: space.s1 },
  footer: { gap: space.s1, paddingTop: space.s1 },
  sheetActions: { gap: space.s2, marginTop: space.s2 },
  link: { minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  linkText: { ...typography.bodyEm, fontSize: 15, fontFamily: fontFamily.bold },
  photo: { width: '100%', height: 200, borderRadius: radius.lg, marginBottom: space.s1 },
  error: { borderRadius: radius.md, padding: space.s2 },
});
