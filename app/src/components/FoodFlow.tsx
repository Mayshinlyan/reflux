import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
} from 'react-native';

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
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { analysisConditions } from '@/constants/conditions';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import {
  createFoodLog,
  createUncheckedMeal,
  getFoodLog,
  promoteCheckToDiary,
  saveMealDetails,
  setMealTime,
  updateFoodCheck,
} from '@/db/repositories/food';
import {
  createSavedFood,
  isFoodSaved,
  listSavedFoods,
  logSavedFood,
  saveCheckedFood,
  saveFoodFromLog,
  type StoredSavedFood,
} from '@/db/repositories/savedFoods';
import { getSetting } from '@/db/repositories/settings';
import { createSymptomLog } from '@/db/repositories/symptoms';
import { type AppDb } from '@/db/types';
import { useAnalyzeFood } from '@/hooks/useAnalyzeFood';
import { useSavedAdditions } from '@/hooks/useSavedAdditions';
import { playChing } from '@/lib/ching';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { dayToLoggedAt, formatMealTime } from '@/lib/mealTime';
import { isLateMeal } from '@/lib/mealTiming';
import { currentTimeZone } from '@/lib/time';
import { deletePhoto, savePhoto } from '@/services/photoStore';
import { cancelCheckIn, scheduleCheckIn } from '@/services/reminders';
import { type AnalysisResult, analyzeFood } from '@/services/relayClient';
import { type PhotoSource, pickFoodPhoto } from '@/services/photoPicker';
import { minTouchTarget, radius, space, typography, useColors } from '@/theme';

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
  // A food saved to favorite foods may not have been eaten yet.
  myFoodTextLabel: "What's the food?",
  analyzeLabel: 'Check this meal',
  saveLabel: 'I ate this',
  updateLabel: 'Update verdict',
  saveUncheckedLabel: 'Log without checking',
  favoriteAdded: 'Added to favorite foods',
  keepOnlyLabel: 'Save to favorite foods only',
  notEatingLabel: 'Not eating this',
  skipLabel: 'Skip for now',
} as const;

/** A meal just logged, which the details step adds to. `canFavorite`: it isn't one of the favorite foods yet. */
type LoggedMeal = { id: number; name: string; canFavorite: boolean };

/** The diary meal the check-in opens on ("Add details" on the Meal logged toast), or null if it's gone. */
function loadLoggedMeal(db: AppDb, id: number): { meal: LoggedMeal; at: Date } | null {
  try {
    const row = getFoodLog(db, id);
    if (!row || row.entryType !== 'diary') return null;
    let canFavorite = false;
    try {
      canFavorite = !isFoodSaved(db, row.mealName);
    } catch {
      // Not offering "Add to favorite foods" is fine.
    }
    return { meal: { id, name: row.mealName, canFavorite }, at: new Date(row.loggedAt) };
  } catch {
    logger.error('loadLoggedMeal', new AppError('INTERNAL'));
    return null;
  }
}

/** What was actually sent, so an edit while loading can't mismatch the saved entry. */
type Analyzed = { source: 'text'; text: string } | { source: 'photo'; uri: string };

/** Checking a food for "Favorite foods" instead of the diary: a new one, or (with `id`) one already saved. */
export type MyFoodTarget = { id?: number; name?: string };

/**
 * The one food screen, for a meal just eaten or one being considered, in three steps (Figma 03b to 03d):
 * capture (a photo or a typed description) → verdict (the belly's mood, why, matched triggers) → details
 * (a How I feel-style check-in: time, lifestyle tags, symptoms, a note; all optional, each group with a "+"
 * to add your own). Saved foods sit on top of the capture step as a Quick
 * log row. Each result is kept as a check (outside the diary); "I ate this" promotes that check, reusing its
 * analysis instead of calling the relay again, and goes back to Today with a "Meal logged · Add details" toast
 * (Figma 13a, and the same for a Quick log chip or "Log without checking"). "Add details" opens this screen on
 * the details step, for that meal (`detailsFor`).
 * `detailsFor` is the id of a meal already in the diary: the flow starts on its details step.
 * `photoUri` is a photo already taken and prepared: the flow starts on its review step.
 * `openCamera` opens the camera as soon as the screen appears (the widget's "Snap food" bubble; a denied camera
 * keeps this screen and says why).
 * With `myFood`, the verdict is saved to "Favorite foods" instead, and nothing goes into the diary.
 * `fromList` ("Log a new food" on the Food list) also offers saving the result to favorite foods only; saving
 * without a verdict still logs the meal to the diary.
 * `date` (a day tapped in Today's week strip) logs the meal at noon of that earlier day instead of now.
 * `quickLog` (a saved food tapped on the home-screen widget) logs that food as soon as the screen appears, exactly
 * like tapping its Quick log chip.
 */
export function FoodFlow({
  photoUri,
  openCamera = false,
  myFood,
  fromList = false,
  date,
  quickLog,
  detailsFor,
}: {
  photoUri?: string;
  openCamera?: boolean;
  myFood?: MyFoodTarget;
  fromList?: boolean;
  date?: string;
  quickLog?: StoredSavedFood;
  detailsFor?: number;
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
  // The meal the optional details are about: one opened from the "Add details" toast (`detailsFor`).
  const [existing] = useState(() => (detailsFor === undefined ? null : loadLoggedMeal(db, detailsFor)));
  const logged = existing?.meal ?? null;
  const finishing = useRef(false);
  /** When the meal was logged, to tell whether the time was changed on the check-in. */
  const loggedAtMs = useRef<number | null>(existing?.at.getTime() ?? null);
  // The Quick log row is for logging what was eaten, so Favorite foods and the Food list's own check leave it out.
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
  const [eatenAt, setEatenAt] = useState(() => existing?.at ?? logTime());
  const [details, setDetails] = useState<MealDetailsState>({
    tags: new Set(),
    symptoms: new Set(),
    note: '',
    keep: false,
  });
  const [pickingTime, setPickingTime] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const additions = useSavedAdditions();
  /** Typed in a "+" chip on the details: saved to My additions and picked on this meal. */
  const addTag = (text: string) => {
    const key = additions.addTag(text);
    if (!key) return;
    Haptics.selectionAsync().catch(() => {});
    setDetails((current) => ({ ...current, tags: new Set(current.tags).add(key) }));
  };
  const addSymptom = (text: string) => {
    const key = additions.addSymptom(text);
    if (!key) return;
    Haptics.selectionAsync().catch(() => {});
    setDetails((current) => ({ ...current, symptoms: new Set(current.symptoms).add(key) }));
  };
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
    // A Favorite foods check isn't a meal being considered, so it isn't kept as a check.
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

  // Favorite foods checks add to the list; an unchecked save then means "by name", not the diary.
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
      // Closing the camera that `openCamera` opened means "never mind": back to where the user came from
      // (or Today, when a widget link opened the app straight here and there is nowhere to go back to).
      if (picked.status === 'canceled' && fromScan) {
        if (router.canGoBack()) router.back();
        else router.replace('/');
      }
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

  const pickTime = () => {
    if (Platform.OS === 'android') pickTimeAndroid(eatenAt, setEatenAt);
    else setPickingTime(true);
  };

  /**
   * A meal was just logged: the nudge, then back to Today with "Meal logged · Add details" (Figma 13a). The
   * details are optional, so nothing stands between the meal and Today; the toast's button opens them.
   */
  const mealLogged = (meal: { id: number; name: string }, at: Date) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playChing();
    toast('Meal logged', {
      action: {
        label: 'Add details',
        onPress: () => router.push({ pathname: '/log/food', params: { details: String(meal.id) } }),
      },
    });
    router.dismissTo('/');
    // The check-in reminder, if they turned it on. It checks the time and the phone's permission itself.
    const reminderMinutes = settings.checkInReminderMinutes;
    if (typeof reminderMinutes === 'number') {
      void scheduleCheckIn({
        mealId: meal.id,
        mealName: meal.name,
        eatenAt: at,
        minutes: reminderMinutes,
        bedtime: settings.bedtime,
      });
    }
  };

  /**
   * Leaves the check-in. "Complete check-in" (`withExtras`) puts the lifestyle tags, note and time on the meal
   * that is already logged, and any symptoms as a symptom log linked to it; "Skip for now" and the X leave
   * those out, except a changed time, which is always kept. A starred favorite is kept either way. The meal's portion is left as it was. Nothing is lost
   * if the extras fail, the meal is saved.
   */
  const leave = (withExtras: boolean) => {
    if (!logged || finishing.current) return;
    finishing.current = true;
    let message: string | null = null;
    if (withExtras) {
      try {
        saveMealDetails(db, logged.id, {
          loggedAt: eatenAt.toISOString(),
          tags: [...details.tags],
          notes: details.note,
        });
        if (details.symptoms.size > 0) {
          createSymptomLog(db, {
            items: [...details.symptoms].map((key) => ({ key })),
            foodLogId: logged.id,
            loggedAt: eatenAt.toISOString(),
          });
          // They just checked in, so the reminder isn't needed.
          void cancelCheckIn(logged.id);
        }
      } catch {
        // Code only: a raw error could echo the note.
        logger.error('saveMealDetails', new AppError('INTERNAL'));
        message = EXTRAS_FAILED;
      }
    } else if (eatenAt.getTime() !== loggedAtMs.current) {
      // Skipping leaves the tags and note out, but a time they changed is still where the meal belongs.
      try {
        setMealTime(db, logged.id, eatenAt.toISOString());
      } catch {
        logger.error('setMealTime', new AppError('INTERNAL'));
        message = EXTRAS_FAILED;
      }
    }
    if (details.keep) {
      try {
        saveFoodFromLog(db, logged.id);
        message ??= copy.favoriteAdded;
      } catch {
        // Code only. Not fatal: the meal is in the diary, and can be added to favorite foods from its entry.
        logger.error('saveFoodFromLog', new AppError('INTERNAL'));
      }
    }
    if (message) toast(message);
    router.dismissTo('/');
  };

  /**
   * "I ate this" (or "Save to favorite foods" for a Favorite foods check): logs exactly the verdict on screen, with no
   * further relay call. A diary meal is logged right away, as of now, and the check-in opens on it. If the
   * stored check can't be promoted, the meal is written to the diary straight from the verdict on screen.
   */
  const save = () => {
    if (!shown || !analyzed || saving.current) return;
    saving.current = true;
    const { meta, ...analysis } = shown;
    const at = logTime();
    let storedPhoto: string | null = null;
    let savedMessage = '';
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
          ? `${saved.mealName} added to favorite foods`
          : `Updated ${saved.mealName} in favorite foods`;
      } else if (checkId.current !== null) {
        try {
          promoteCheckToDiary(db, checkId.current, at.toISOString());
          diaryId = checkId.current;
        } catch {
          // Code only. The verdict on screen is still written below, so "I ate this" always logs the meal.
          logger.error('promoteCheckToDiary', new AppError('INTERNAL'));
        }
      }
      if (!myFood && diaryId === null) {
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
      mealLogged({ id: diaryId, name: analysis.mealName }, at);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast(savedMessage);
    router.back();
  };

  /** "Save to favorite foods only" (from the Food list): keeps the verdict for one-tap logging, without eating it now. */
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
    toast(
      saved.created
        ? `${saved.mealName} added to favorite foods`
        : `Updated ${saved.mealName} in favorite foods`,
    );
    router.back();
  };

  /**
   * "Log without checking": what was typed becomes a plain diary entry, with no relay call (works offline), and
   * the details open on it. For Favorite foods it is added by name instead, which has no time or details.
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
      toast(`${trimmed} added to favorite foods`);
      router.back();
      return;
    }
    mealLogged({ id: mealId, name: trimmed }, at);
  };

  /** A photo whose check failed can still be logged: the meal is just "Meal" with its photo, no verdict, no relay call. */
  const saveUncheckedPhoto = () => {
    if (analyzed?.source !== 'photo' || busy || saving.current) return;
    saving.current = true;
    const at = logTime();
    let storedPhoto: string | null = null;
    let mealId: number;
    try {
      storedPhoto = savePhoto(analyzed.uri);
      mealId = createUncheckedMeal(db, {
        source: 'photo',
        photoUri: storedPhoto,
        loggedAt: at.toISOString(),
      });
    } catch {
      if (storedPhoto) deletePhoto(storedPhoto);
      saving.current = false;
      logger.error('saveFoodLog', new AppError('INTERNAL'));
      toast("We couldn't save that. Please try again.");
      return;
    }
    mealLogged({ id: mealId, name: 'Meal' }, at);
  };

  /** Cancel while a check is running: the request is dropped and the photo or text stays as it was. */
  const cancelCheck = () => reset();

  /** A Quick log chip: logs the food with the verdict it was saved with (no relay call), and opens the details. */
  const logQuick = (food: StoredSavedFood) => {
    if (busy || saving.current) return;
    saving.current = true;
    const at = logTime();
    let mealId: number;
    try {
      mealId = logSavedFood(db, food.id, at.toISOString());
    } catch {
      saving.current = false;
      // Code only: a raw error could echo the food name.
      logger.error('logSavedFood', new AppError('INTERNAL'));
      toast("We couldn't save that. Please try again.");
      return;
    }
    mealLogged({ id: mealId, name: food.mealName }, at);
  };

  // `quickLog`: log the saved food straight away, once.
  const quickLogged = useRef(false);
  useEffect(() => {
    if (!quickLog || quickLogged.current) return;
    quickLogged.current = true;
    logQuick(quickLog);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on arrival; logQuick's state is fresh then
  }, [quickLog]);

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

  // Unchecked saves go to the diary; for Favorite foods only a new food typed by name can skip the verdict.
  const canSaveUnchecked = !myFood || myFood.id === undefined;
  const reviewingPhoto = state.status !== 'done' && !busy && analyzed?.source === 'photo';
  const errorText = notice ?? (state.status === 'error' ? state.error.friendlyMessage : '');
  const errorBanner = errorText ? (
    <View accessibilityRole="alert" style={[styles.error, { backgroundColor: colors.redTint }]}>
      <AppText color="redInk">{errorText}</AppText>
    </View>
  ) : null;

  // Log screens slide up as a modal, so a swipe down closes them. That is only on while the plain Food screen
  // is empty, so a stray drag can't drop a typed description or a photo.
  const navigation = useNavigation();
  const swipeAway =
    !myFood && !fromList && !openCamera && !analyzed && !text && !draft && !busy && logged === null;
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: swipeAway });
  }, [navigation, swipeAway]);

  const now = new Date();
  // The verdict is about the meal as it will be logged: now, or noon of the picked day.
  const mealAt = logTime();
  const verdictLate =
    shown !== null &&
    isLateMeal(mealAt.toISOString(), currentTimeZone(), settings.bedtime, settings.lateMealWindowMinutes);
  // Back walks the steps: details → verdict → capture, then leaves.
  const backToCapture = () => {
    setCorrection('');
    setUpdated(null);
    reset();
  };
  // Once logged there is nothing to step back to: the X ends the flow, like "Skip for now".
  const onBack = logged ? () => leave(false) : showResult ? backToCapture : undefined;
  const onDetails = logged !== null;
  const typed = trimmed.toLowerCase();
  const quickFoods = savedFoods
    .filter((food) => !typed || food.mealName.toLowerCase().includes(typed))
    .map((food) => ({ id: food.id, name: food.mealName }));

  let body;
  if (onDetails) {
    body = (
      <FoodDetails
        mealName={logged?.name ?? ''}
        canFavorite={logged?.canFavorite ?? false}
        whenLabel={formatMealTime(eatenAt, now)}
        onPickTime={pickTime}
        state={details}
        onChange={setDetails}
        maxNote={MAX_NOTE}
        ownTags={additions.ownTagKeys}
        ownSymptoms={additions.ownSymptomKeys}
        onAddTag={addTag}
        onAddSymptom={addSymptom}
        onReveal={(y) => scroll.current?.scrollTo({ y: Math.max(0, y - space.s2), animated: true })}
      />
    );
  } else if (showResult && shown) {
    body = <FoodVerdict analysis={shown} late={verdictLate} />;
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
          {state.status === 'error' && canSaveUnchecked && (
            <Button label={copy.saveUncheckedLabel} variant="quiet" onPress={saveUncheckedPhoto} />
          )}
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
  if (onDetails) {
    footer = (
      <View style={styles.footer}>
        <Button label="Complete check-in" onPress={() => leave(true)} />
        <Pressable accessibilityRole="button" onPress={() => leave(false)} style={styles.link}>
          <AppText style={[styles.linkText, { color: colors.clayInk }]}>{copy.skipLabel}</AppText>
        </Pressable>
      </View>
    );
  } else if (showResult) {
    footer = (
      <View style={styles.footer}>
        <Button label={myFood ? 'Save to favorite foods' : copy.saveLabel} onPress={save} />
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
  } else if (state.status === 'loading' && !preparing && !correcting) {
    footer = (
      <View style={styles.footer}>
        <Button label="Cancel" variant="quiet" onPress={cancelCheck} />
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
    <Screen>
      <BackHeader
        title={myFood ? (myFood.id === undefined ? 'Add a food' : 'Get a verdict') : undefined}
        onBack={onBack}
        close={logged !== null}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroll}
          // A fresh scroll position for each step, so details don't open scrolled down from the verdict.
          key={logged ? 'logged' : showResult ? 'verdict' : busy ? 'busy' : 'capture'}
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
        <AppText variant="section" accessibilityRole="header">
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
        <AppText variant="section" accessibilityRole="header">
          Not quite right?
        </AppText>
        <View style={styles.sheetActions}>
          <TextField
            label="Tell us more"
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
      <MealTimeSheet
        visible={pickingTime}
        question="When did you eat this?"
        confirmLabel="Set time"
        onConfirm={(at) => {
          setPickingTime(false);
          setEatenAt(at ?? new Date());
        }}
        onClose={() => setPickingTime(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: space.s3 },
  actions: { gap: space.s1 },
  footer: { gap: space.s1_5, paddingTop: space.s2 },
  sheetActions: { gap: space.s2, marginTop: space.s2 },
  link: { minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  linkText: typography.button,
  photo: { width: '100%', height: 200, borderRadius: radius.lg, marginBottom: space.s1 },
  error: { borderRadius: radius.md, padding: space.s2 },
});
