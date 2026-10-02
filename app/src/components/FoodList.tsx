import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { Pencil, Utensils } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { MealResultCard } from '@/components/MealResultCard';
import { MealTimeSheet, pickTimeAndroid } from '@/components/MealTimeSheet';
import { Screen } from '@/components/Screen';
import { SwipeNav } from '@/components/SwipeNav';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { VERDICT_LABELS } from '@/components/VerdictBadge';
import { VerdictSelect } from '@/components/VerdictSelect';
import { useDb } from '@/db/DatabaseProvider';
import { listDiaryFoodLogs } from '@/db/repositories/food';
import {
  listSavedFoods,
  logSavedFood,
  MAX_SAVED_FOOD_NAME,
  removeSavedFood,
  renameSavedFood,
  type SavedFoodEdit,
  type StoredSavedFood,
  updateSavedFood,
} from '@/db/repositories/savedFoods';
import type { AppDb } from '@/db/types';
import { playChing } from '@/lib/ching';
import { AppError, friendlyMessages } from '@/lib/errors';
import { formatTime, localDayKey } from '@/lib/localDay';
import { logger } from '@/lib/logger';
import { foodSwipe } from '@/lib/logSwipe';
import { formatIngredients, parseIngredients, withIngredients } from '@/lib/ingredients';
import { effectiveVerdict, withUserVerdict } from '@/lib/verdict';
import { formatMealTime } from '@/lib/mealTime';
import { currentTimeZone } from '@/lib/time';
import { type PhotoSource, pickFoodPhoto } from '@/services/photoPicker';
import { deletePhoto, savePhoto } from '@/services/photoStore';
import { type AnalysisResult, analyzeFood } from '@/services/relayClient';
import type { AppVerdict } from '@/types/analysis';
import { minTouchTarget, radius, space, typography, useColors } from '@/theme';

/** How long a row says "Logged ✓" (and ignores taps) after a one-tap log, so a double-tap can't log twice. */
const LOGGED_FLASH_MS = 2500;
const DAY_MS = 86_400_000;
/** The relay's cap on `details`, and ours on the ingredient list typed in the sheet. */
const MAX_DETAILS = 300;
/** Shown in the sheet's photo tile when a food has no photo. */
const FILLER_PHOTO = require('@/assets/images/filler.jpg');

/** What has been eaten today, per meal name (lower case): how many times and when last. */
type EatenToday = Map<string, { count: number; lastAt: string; tz: string }>;

function loadEatenToday(db: AppDb): EatenToday {
  const now = new Date();
  const tz = currentTimeZone();
  const today = localDayKey(now.toISOString(), tz);
  const meals = listDiaryFoodLogs(db, {
    from: new Date(now.getTime() - 2 * DAY_MS).toISOString(),
    to: new Date(now.getTime() + DAY_MS).toISOString(),
  });
  const eaten: EatenToday = new Map();
  for (const meal of meals) {
    if (localDayKey(meal.loggedAt, meal.tz) !== today) continue;
    const key = meal.mealName.toLowerCase();
    // Meals come oldest first, so the last one seen is the most recent.
    eaten.set(key, { count: (eaten.get(key)?.count ?? 0) + 1, lastAt: meal.loggedAt, tz: meal.tz });
  }
  return eaten;
}

/**
 * The saved foods as "Quick Log" cards. From Log, tapping a card asks when it was eaten (now, or earlier in
 * the past week), then logs it with the verdict it was saved with, no new analysis. From Settings > My foods
 * (`manage`), tapping a card opens it to rename, re-check or remove, a Log button logs it, and a left swipe
 * deletes it. "Log a new food" checks one from a photo or a description; the result can be logged as eaten,
 * saved to this list, or both.
 */
export function FoodList({ manage = false }: { manage?: boolean }) {
  const colors = useColors();
  const db = useDb();
  const toast = useToast();

  const [foods, setFoods] = useState<StoredSavedFood[]>([]);
  const [eaten, setEaten] = useState<EatenToday>(new Map());
  const [loadFailed, setLoadFailed] = useState(false);
  const [justLogged, setJustLogged] = useState<ReadonlySet<number>>(new Set());
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  // The food whose Log was tapped, while the "When did you eat this?" sheet is open (iPhone).
  const [logging, setLogging] = useState<StoredSavedFood | null>(null);

  const [editing, setEditing] = useState<StoredSavedFood | null>(null);
  // What the sheet shows. Not cleared on close, so the sheet keeps its content while it slides away.
  const [sheetFood, setSheetFood] = useState<StoredSavedFood | null>(null);
  const [name, setName] = useState('');
  // Edits made in the sheet. `photo` is a new photo not yet stored; `rechecked` is a verdict from Check
  // again, kept only when Save is tapped. `checked` is what the verdict on screen was made from, so
  // Check again shows only once the photo or ingredients differ from it.
  const [ingredientsText, setIngredientsText] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [rechecked, setRechecked] = useState<AnalysisResult | null>(null);
  const [checked, setChecked] = useState<{ ingredients: string; photo: string | undefined }>({
    ingredients: '',
    photo: undefined,
  });
  // The verdict chosen in the chips (the AI's own, or the user's over it); null for a food with none.
  const [verdict, setVerdict] = useState<AppVerdict | null>(null);
  const [checking, setChecking] = useState(false);
  // False: the sheet shows the verdict. True: the edit fields are open (after the Edit button).
  const [changing, setChanging] = useState(false);
  const editingId = useRef<number | null>(null);

  const reload = useCallback(() => {
    try {
      setFoods(listSavedFoods(db));
      setEaten(loadEatenToday(db));
      setLoadFailed(false);
    } catch (error) {
      logger.error('loadSavedFoods', error);
      setLoadFailed(true);
    }
  }, [db]);
  useFocusEffect(reload);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const trimmedName = name.trim();
  const closeForm = () => {
    editingId.current = null;
    setEditing(null);
  };
  /** Puts every edit back to how the food is saved. */
  const resetEdits = (food: StoredSavedFood) => {
    const ingredients = food.analysis ? formatIngredients(food.analysis) : '';
    setName(food.mealName);
    setIngredientsText(ingredients);
    setPhoto(undefined);
    setRechecked(null);
    setVerdict(food.analysis ? effectiveVerdict(food.analysis) : null);
    setChecked({ ingredients, photo: undefined });
    setChecking(false);
  };
  /** Tapping a food shows its verdict; the edit fields wait for the Edit button. */
  const openEdit = (food: StoredSavedFood) => {
    editingId.current = food.id;
    resetEdits(food);
    setChanging(false);
    setEditing(food);
    setSheetFood(food);
  };
  const cancelChanges = () => {
    if (!editing) return;
    editingId.current = editing.id; // drops a Check again still in flight
    resetEdits(editing);
    setChanging(false);
  };

  /** "Log a new food": the photo/text check. */
  const addFood = () => router.push({ pathname: '/log/food', params: { check: '1' } });

  const checkFood = () => {
    if (!editing) return;
    const id = editing.id;
    // Keep a rename typed before tapping here; the checked food keeps that name.
    if (trimmedName && trimmedName !== editing.mealName) {
      try {
        renameSavedFood(db, id, trimmedName);
      } catch (error) {
        logger.error('renameSavedFood', error);
      }
    }
    setEditing(null);
    router.push({ pathname: '/log/food', params: { myFood: '1', food: String(id) } });
  };

  /** Log was tapped: ask when it was eaten first. */
  const askWhen = (food: StoredSavedFood) => {
    if (Platform.OS === 'android') pickTimeAndroid(new Date(), (at) => logOnce(food, at));
    else setLogging(food);
  };

  /** Logs the food at `at`, or right now when `at` is null. */
  const logOnce = (food: StoredSavedFood, at: Date | null) => {
    // `disabled` only applies after a re-render, so two taps in the same instant must be caught here.
    if (timers.current.has(food.id)) return;
    try {
      logSavedFood(db, food.id, at?.toISOString());
    } catch (error) {
      logger.error('logSavedFood', error);
      Alert.alert("Couldn't log", friendlyMessages.INTERNAL);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    playChing();
    // An earlier meal doesn't show under "Eaten today", so the toast says when it was logged for.
    toast(at ? `${food.mealName} logged for ${formatMealTime(at, new Date())}` : `${food.mealName} logged`);
    setJustLogged((current) => new Set(current).add(food.id));
    timers.current.set(
      food.id,
      setTimeout(() => {
        timers.current.delete(food.id);
        setJustLogged((current) => {
          const next = new Set(current);
          next.delete(food.id);
          return next;
        });
      }, LOGGED_FLASH_MS),
    );
    reload();
  };

  const ingredientNames = parseIngredients(ingredientsText);
  const ingredientsChanged = ingredientNames.join(',') !== parseIngredients(checked.ingredients).join(',');
  const photoChanged = photo !== checked.photo;
  // Only a food with a verdict can be checked again; one without gets "Get a verdict".
  const canCheckAgain = Boolean(sheetFood?.analysis) && (ingredientsChanged || photoChanged);

  // A verdict from Check again replaces the saved one on screen until it is saved.
  const checkedAnalysis = rechecked ?? sheetFood?.analysis ?? null;
  const shownAnalysis =
    checkedAnalysis && verdict ? withUserVerdict(checkedAnalysis, verdict) : checkedAnalysis;

  const pickPhoto = async (source: PhotoSource) => {
    try {
      const picked = await pickFoodPhoto(source);
      if (picked.status === 'ok') setPhoto(picked.photo.uri);
      else if (picked.status === 'denied')
        toast('Camera access is off. You can turn it on in Settings, or choose a photo instead.');
    } catch {
      // Code only: the picker or manipulator error could carry file paths.
      logger.error('preparePhoto', new AppError('INPUT_REJECTED'));
      toast(new AppError('INPUT_REJECTED').friendlyMessage);
    }
  };

  const changePhoto = () =>
    Alert.alert('Food photo', undefined, [
      { text: 'Take a photo', onPress: () => void pickPhoto('camera') },
      { text: 'Choose a photo', onPress: () => void pickPhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  /** "Check again": a new verdict from the edited photo and ingredients. Nothing is stored until Save. */
  const checkAgain = async () => {
    if (!editing || checking) return;
    const id = editing.id;
    const photoUri = photo ?? editing.photoUri;
    // The ingredients are sent only when edited, so a new photo isn't overruled by the old list.
    const details = ingredientsChanged
      ? `The ingredients are: ${ingredientNames.join(', ')}`.slice(0, MAX_DETAILS)
      : undefined;
    setChecking(true);
    try {
      const result = await analyzeFood({
        ...(photoUri ? { photo: { uri: photoUri, mimeType: 'image/jpeg' } } : { text: trimmedName }),
        ...(details ? { details } : {}),
      });
      // The sheet may have been closed, or opened for another food, while this ran.
      if (editingId.current !== id) return;
      const ingredients = formatIngredients(result);
      setRechecked(result);
      setIngredientsText(ingredients);
      setChecked({ ingredients, photo });
      // The AI re-judged the food, so its new verdict replaces one set by hand.
      const replaced = verdict !== null && verdict !== checkedAnalysis?.overall.verdict;
      setVerdict(result.overall.verdict);
      toast(
        replaced ? 'Verdict updated, replacing yours. Save to keep it.' : 'Verdict updated. Save to keep it.',
      );
    } catch (caught) {
      if (editingId.current !== id) return;
      const error = caught instanceof AppError ? caught : new AppError('INTERNAL');
      logger.error('analyzeFood', error);
      // The edits stay so the user can try again.
      toast(error.friendlyMessage);
    } finally {
      if (editingId.current === id) setChecking(false);
    }
  };

  const save = () => {
    if (!editing || !trimmedName || checking) return;
    let storedPhoto: string | undefined;
    try {
      if (photo) storedPhoto = savePhoto(photo);
      const edit: SavedFoodEdit = { name: trimmedName, photoUri: storedPhoto };
      if (rechecked) {
        const { meta, ...checkedAnalysis } = rechecked;
        // Ingredients edited since that check are kept on top of its verdict.
        const analysis = ingredientsChanged
          ? withIngredients(checkedAnalysis, ingredientNames)
          : checkedAnalysis;
        edit.check = { analysis, meta };
      } else if (editing.analysis && ingredientsChanged) {
        edit.ingredients = ingredientNames;
      }
      if (verdict && (rechecked ?? editing.analysis)) edit.verdict = verdict;
      updateSavedFood(db, editing.id, edit);
    } catch (error) {
      if (storedPhoto) deletePhoto(storedPhoto);
      logger.error('updateSavedFood', error);
      Alert.alert("Couldn't save", friendlyMessages.INTERNAL);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast('Changes saved');
    closeForm();
    reload();
  };

  /** From the edit sheet or a left swipe on a row: asks first, then takes the food off the list. */
  const confirmRemove = (id: number, label: string) => {
    Alert.alert(`Remove ${label || 'this food'}?`, 'It leaves your list, but past meals stay in Your Logs.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          try {
            removeSavedFood(db, id);
          } catch (error) {
            logger.error('removeSavedFood', error);
            Alert.alert("Couldn't remove", friendlyMessages.INTERNAL);
            return;
          }
          toast('Removed from your list');
          setEditing(null);
          reload();
        },
      },
    ]);
  };

  return (
    <SwipeNav {...foodSwipe} enabled={!logging && !editing && !sheetFood}>
      <Screen>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BackHeader title="Log food" />
          {loadFailed && foods.length === 0 ? (
            <AppText color="inkSoft" style={styles.empty}>
              {`${friendlyMessages.INTERNAL} Your foods are still on this phone.`}
            </AppText>
          ) : foods.length === 0 ? (
            <AppText color="inkSoft" style={styles.empty}>
              Add the foods you eat often, or save a meal from Your Logs, then log each one with a single tap.
            </AppText>
          ) : (
            <>
              <AppText variant="label" color="inkSoft" accessibilityRole="header" style={styles.heading}>
                Quick Log
              </AppText>
              {foods.map((food) => {
                const today = eaten.get(food.mealName.toLowerCase());
                const done = justLogged.has(food.id);
                const card = (
                  <View
                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={manage ? `Edit ${food.mealName}` : `Log ${food.mealName}`}
                      accessibilityState={{ disabled: done && !manage }}
                      disabled={done && !manage}
                      // Swiping isn't possible with a screen reader, so offer Delete from its actions menu.
                      accessibilityActions={manage ? [{ name: 'delete', label: 'Delete' }] : undefined}
                      onAccessibilityAction={(event) => {
                        if (event.nativeEvent.actionName === 'delete') confirmRemove(food.id, food.mealName);
                      }}
                      onPress={() => (manage ? openEdit(food) : askWhen(food))}
                      style={styles.info}>
                      {food.photoUri ? (
                        <Image source={{ uri: food.photoUri }} style={styles.icon} contentFit="cover" />
                      ) : (
                        <View style={[styles.icon, { backgroundColor: colors.clayTint }]}>
                          <Utensils size={18} color={colors.clayInk} strokeWidth={2.2} />
                        </View>
                      )}
                      <View style={styles.text}>
                        <AppText style={styles.foodName} numberOfLines={2}>
                          {food.mealName}
                        </AppText>
                        <AppText variant="caption" color="inkSoft">
                          {food.overallVerdict ? VERDICT_LABELS[food.overallVerdict] : 'No verdict'}
                          {today
                            ? ` · Eaten today ${formatTime(today.lastAt, today.tz)}${today.count > 1 ? ` (${today.count}×)` : ''}`
                            : ''}
                        </AppText>
                      </View>
                    </Pressable>
                    {manage ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={done ? `${food.mealName} logged` : `Log ${food.mealName}`}
                        accessibilityState={{ disabled: done }}
                        disabled={done}
                        onPress={() => askWhen(food)}
                        style={({ pressed }) => [
                          styles.logButton,
                          {
                            backgroundColor: done ? colors.sageInk : colors.sageTint,
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}>
                        <AppText style={[styles.logText, { color: done ? colors.ctaInk : colors.sageInk }]}>
                          {done ? 'Logged ✓' : 'Log'}
                        </AppText>
                      </Pressable>
                    ) : null}
                  </View>
                );
                return manage ? (
                  <SwipeToDelete
                    key={food.id}
                    label={food.mealName}
                    style={styles.row}
                    onDelete={() => confirmRemove(food.id, food.mealName)}>
                    {card}
                  </SwipeToDelete>
                ) : (
                  <View key={food.id} style={styles.row}>
                    {card}
                  </View>
                );
              })}
            </>
          )}
          <Pressable accessibilityRole="button" onPress={addFood} style={styles.add}>
            <AppText style={[styles.addText, { color: colors.clayInk }]}>+ Log a new food</AppText>
          </Pressable>
        </ScrollView>

        <MealTimeSheet
          visible={logging !== null}
          question="When did you eat this?"
          confirmLabel="Log it"
          onConfirm={(at) => {
            const food = logging;
            setLogging(null);
            if (food) logOnce(food, at);
          }}
          onClose={() => setLogging(null)}
        />

        <BottomSheet visible={editing !== null} onClose={closeForm} scrollToTopKey={changing}>
          {/* The saved verdict first, like a meal in Your Logs; editing sits below it. */}
          <AppText variant="title" accessibilityRole="header" style={styles.sheetTitle}>
            {sheetFood?.mealName}
          </AppText>
          {/* Always there, so a food without a photo has an empty tile; the pencil waits for Edit. */}
          <View style={styles.sheetPhoto}>
            {(photo ?? sheetFood?.photoUri) ? (
              <Image
                source={{ uri: photo ?? sheetFood?.photoUri ?? undefined }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                accessibilityLabel="Your food photo"
              />
            ) : (
              <Image
                source={FILLER_PHOTO}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                accessibilityLabel="No photo yet"
              />
            )}
            {changing ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit photo"
                // 36 + 2×6 = 48, the Android touch target
                hitSlop={6}
                onPress={changePhoto}
                style={({ pressed }) => [styles.photoEdit, { opacity: pressed ? 0.7 : 1 }]}>
                <Pencil size={18} color="#fff" strokeWidth={2.2} />
              </Pressable>
            ) : null}
          </View>
          {shownAnalysis ? (
            <MealResultCard analysis={shownAnalysis} showTitle={false} />
          ) : (
            <AppText color="inkSoft">No verdict yet.</AppText>
          )}
          {changing ? (
            <>
              <View style={styles.sheetField}>
                <TextField
                  label="Name"
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. oatmeal with banana"
                  maxLength={MAX_SAVED_FOOD_NAME}
                  returnKeyType="done"
                  onSubmitEditing={save}
                />
                {sheetFood?.analysis ? (
                  <TextField
                    label="Ingredients"
                    hint="(separate with commas)"
                    value={ingredientsText}
                    onChangeText={setIngredientsText}
                    placeholder="e.g. oats, banana, milk"
                    maxLength={MAX_DETAILS}
                    multiline
                  />
                ) : null}
                {verdict ? <VerdictSelect value={verdict} onChange={setVerdict} /> : null}
              </View>
              <Button label="Save" onPress={save} disabled={!trimmedName || checking} />
              <View style={styles.secondary}>
                {/* Check again waits for an edit to the photo or ingredients. */}
                {canCheckAgain && (
                  <Button
                    label={checking ? 'Checking…' : 'Check again'}
                    variant="secondary"
                    onPress={() => void checkAgain()}
                    disabled={checking}
                  />
                )}
                <Button label="Cancel" variant="quietDanger" onPress={cancelChanges} />
              </View>
            </>
          ) : (
            <View style={styles.secondary}>
              <Button label="Edit" onPress={() => setChanging(true)} />
              {/* A food with no verdict yet goes through the verdict flow, and keeps its name. */}
              {!sheetFood?.analysis && (
                <Button label="Get a verdict" variant="secondary" onPress={checkFood} />
              )}
              <Button
                label="Remove from my list"
                variant="quietDanger"
                onPress={() => editing && confirmRemove(editing.id, editing.mealName)}
              />
            </View>
          )}
        </BottomSheet>
      </Screen>
    </SwipeNav>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.s4 },
  empty: { marginBottom: space.s2, lineHeight: 24 },
  heading: { marginBottom: space.s1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: space.s1,
    paddingLeft: space.s1,
    paddingRight: space.s1,
  },
  // On the swipe container, not the card, so the revealed Delete button is exactly the card's height.
  row: { marginBottom: space.s1 },
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
  foodName: { ...typography.bodyEm, fontSize: 15, lineHeight: 20, fontFamily: 'Nunito_700Bold' },
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
  sheetTitle: { marginBottom: space.s1 },
  sheetPhoto: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: space.s1,
  },
  photoEdit: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(46,42,38,0.72)',
  },
  sheetField: { marginTop: space.s2, marginBottom: space.s1 },
  secondary: { marginTop: space.s1, gap: space.s1 },
});
