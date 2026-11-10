import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { Pencil, Utensils } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { MealResultCard } from '@/components/MealResultCard';
import { Screen } from '@/components/Screen';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { VERDICT_LABELS } from '@/components/VerdictBadge';
import { VerdictSelect } from '@/components/VerdictSelect';
import { analysisConditions } from '@/constants/conditions';
import { useDb } from '@/db/DatabaseProvider';
import {
  listSavedFoods,
  MAX_SAVED_FOOD_NAME,
  removeSavedFood,
  renameSavedFood,
  type SavedFoodEdit,
  type StoredSavedFood,
  updateSavedFood,
} from '@/db/repositories/savedFoods';
import { getSetting } from '@/db/repositories/settings';
import { AppError, friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { formatIngredients, parseIngredients, withIngredients } from '@/lib/ingredients';
import { effectiveVerdict, withUserVerdict } from '@/lib/verdict';
import { type PhotoSource, pickFoodPhoto } from '@/services/photoPicker';
import { deletePhoto, photoUri as storedPhotoUri, savePhoto } from '@/services/photoStore';
import { type AnalysisResult, analyzeFood } from '@/services/relayClient';
import type { AppVerdict } from '@/types/analysis';
import { cardEdge, minTouchTarget, radius, space, typography, useColors } from '@/theme';

/** The relay's cap on `details`, and ours on the ingredient list typed in the sheet. */
const MAX_DETAILS = 300;
/** Shown in the sheet's photo tile when a food has no photo. */
const FILLER_PHOTO = require('@/assets/images/filler.jpg');

/**
 * Favorite foods (Profile > Favorite foods, and "See all" in the food capture's Quick log row): the saved foods as
 * filled cards (Figma row 25, the same layout as Medications and Usual symptoms: a title, the cards, an "Add" button
 * at the bottom, no instruction line). Tapping a card opens it to rename, re-check or remove, and a left swipe
 * deletes it. Logging a favorite happens in the food capture's Quick log chips, not here. "Add a food" checks one
 * from a photo or a description and saves it to this list; it is not logged as eaten.
 */
export function FoodList() {
  const colors = useColors();
  const db = useDb();
  const toast = useToast();

  const [foods, setFoods] = useState<StoredSavedFood[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

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
      setLoadFailed(false);
    } catch (error) {
      logger.error('loadSavedFoods', error);
      setLoadFailed(true);
    }
  }, [db]);
  useFocusEffect(reload);

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

  /** "Add a food": the photo/text check, saved to favorite foods and never to the diary (Figma 41d, 41e). */
  const addFood = () => router.push({ pathname: '/log/food', params: { myFood: '1' } });

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
    const photoUri = photo ?? (editing.photoUri ? storedPhotoUri(editing.photoUri) : null);
    // The ingredients are sent only when edited, so a new photo isn't overruled by the old list.
    const details = ingredientsChanged
      ? `The ingredients are: ${ingredientNames.join(', ')}`.slice(0, MAX_DETAILS)
      : undefined;
    setChecking(true);
    try {
      const result = await analyzeFood({
        ...(photoUri ? { photo: { uri: photoUri, mimeType: 'image/jpeg' } } : { text: trimmedName }),
        ...(details ? { details } : {}),
        ...analysisConditions(getSetting(db, 'conditions')),
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
    Alert.alert(`Remove ${label || 'this food'}?`, 'It leaves your list, but past meals stay in History.', [
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
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BackHeader />
        <AppText variant="display" accessibilityRole="header" style={styles.title}>
          Favorite foods
        </AppText>
        {loadFailed && foods.length === 0 ? (
          <AppText color="inkSoft" style={styles.empty}>
            {`${friendlyMessages.INTERNAL} Your foods are still on this phone.`}
          </AppText>
        ) : foods.length === 0 ? (
          <AppText color="inkSoft" style={styles.empty}>
            No favorite foods yet.
          </AppText>
        ) : (
          <>
            {foods.map((food) => {
              const card = (
                <View style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${food.mealName}`}
                    // Swiping isn't possible with a screen reader, so offer Delete from its actions menu.
                    accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
                    onAccessibilityAction={(event) => {
                      if (event.nativeEvent.actionName === 'delete') confirmRemove(food.id, food.mealName);
                    }}
                    onPress={() => openEdit(food)}
                    style={styles.info}>
                    {food.photoUri ? (
                      <Image
                        source={{ uri: storedPhotoUri(food.photoUri) }}
                        style={styles.icon}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.icon, { backgroundColor: colors.honeyTint }]}>
                        <Utensils size={20} color={colors.honeyInk} strokeWidth={2} />
                      </View>
                    )}
                    <View style={styles.text}>
                      <AppText style={styles.foodName} numberOfLines={2}>
                        {food.mealName}
                      </AppText>
                      <AppText variant="caption" color="inkSoft">
                        {food.overallVerdict ? VERDICT_LABELS[food.overallVerdict] : 'No verdict'}
                      </AppText>
                    </View>
                  </Pressable>
                </View>
              );
              return (
                <SwipeToDelete
                  key={food.id}
                  label={food.mealName}
                  style={styles.row}
                  onDelete={() => confirmRemove(food.id, food.mealName)}>
                  {card}
                </SwipeToDelete>
              );
            })}
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Add a food" variant="secondary" onPress={addFood} />
      </View>

      {/* On the page `bg`, so the fields' `surface` fill shows as boxes before they are focused. */}
      <BottomSheet visible={editing !== null} onClose={closeForm} scrollToTopKey={changing} tone="bg">
        {/* The saved verdict first, like a meal in History; editing sits below it. */}
        <AppText variant="section" accessibilityRole="header" style={styles.sheetTitle}>
          {sheetFood?.mealName}
        </AppText>
        {/* Always there, so a food without a photo has an empty tile; the pencil waits for Edit. */}
        <View style={styles.sheetPhoto}>
          {(photo ?? sheetFood?.photoUri) ? (
            <Image
              source={{
                uri: photo ?? (sheetFood?.photoUri ? storedPhotoUri(sheetFood.photoUri) : undefined),
              }}
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
              <Pencil size={20} color="#fff" strokeWidth={2} />
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
              <Button label="Cancel" variant="quiet" onPress={cancelChanges} />
            </View>
          </>
        ) : (
          <View style={styles.secondary}>
            <Button label="Edit" onPress={() => setChanging(true)} />
            {/* A food with no verdict yet goes through the verdict flow, and keeps its name. */}
            {!sheetFood?.analysis && <Button label="Get a verdict" variant="secondary" onPress={checkFood} />}
            <Button
              label="Remove from my list"
              variant="quietDanger"
              onPress={() => editing && confirmRemove(editing.id, editing.mealName)}
            />
          </View>
        )}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  content: { paddingBottom: space.s3 },
  empty: { marginBottom: space.s2 },
  // No instruction line under the title, so the title itself leaves the gap before the first card.
  title: { marginBottom: space.s4 },
  footer: { paddingTop: space.s2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    borderRadius: radius.lg,
    paddingVertical: space.s1,
    paddingLeft: space.s1,
    paddingRight: space.s1,
  },
  // On the swipe container, not the card, so the revealed Delete button is exactly the card's height.
  row: { marginBottom: space.s1_5 },
  info: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1_5,
    minHeight: minTouchTarget,
    padding: 4,
  },
  icon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  foodName: typography.button,
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
