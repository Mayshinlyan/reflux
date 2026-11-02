import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Leaf,
  Lightbulb,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { AddIngredientsSheet, SwapSheet } from '@/components/kitchen/IngredientEditSheets';
import { IngredientGrid } from '@/components/kitchen/IngredientGrid';
import { RecipeArt } from '@/components/kitchen/RecipeArt';
import { SnapCards } from '@/components/kitchen/SnapCards';
import { StepCard } from '@/components/kitchen/StepCard';
import { UpdatingModal } from '@/components/kitchen/UpdatingModal';
import { Screen } from '@/components/Screen';
import { useToast } from '@/components/Toast';
import type { CuisineKey } from '@/constants/cuisines';
import { useDb } from '@/db/DatabaseProvider';
import {
  findSavedRecipe,
  getSavedRecipe,
  removeSavedRecipe,
  saveRecipe,
  setRecipeRating,
  type StoredRecipe,
  updateSavedRecipe,
} from '@/db/repositories/savedRecipes';
import { getSetting } from '@/db/repositories/settings';
import type { AppDb } from '@/db/types';
import { AppError, type ErrorCode, friendlyMessages } from '@/lib/errors';
import { buildAdjustRequest, pushUndo } from '@/lib/kitchen';
import { editErrorMessage } from '@/lib/kitchenCopy';
import { logger } from '@/lib/logger';
import { recipeMeta } from '@/lib/recipe';
import { getRecipeDraft } from '@/lib/recipeDraft';
import { lookFor } from '@/lib/recipeLook';
import { adjustRecipe } from '@/services/relayClient';
import { minTouchTarget, radius, space, useColors } from '@/theme';
import type { Recipe, RecipeChange } from '@/types/recipe';

type Shown = { recipe: Recipe; cuisine: CuisineKey; saved: StoredRecipe | null };

/**
 * A recipe, opened from a Kitchen idea (`/recipe`) or from the saved list (`/recipe?saved=<id>`), Figma row 29e: the
 * dish, why it goes easy on the belly, the ingredients and steps on white cards, then Save and Log this meal. Once a
 * recipe is saved, thumbs ask how it was. Amounts are in US cups and spoons, as the recipe service writes them.
 */
export default function RecipeScreen() {
  const db = useDb();
  const colors = useColors();
  const { saved: savedParam } = useLocalSearchParams<{ saved?: string }>();
  const [shown, setShown] = useState<Shown | null>(() => load(db, savedParam));
  const [failed, setFailed] = useState(false);
  // The ingredients start open, and open again each time the page opens.
  const [open, setOpen] = useState(true);
  // The versions before each ingredient edit, newest last, for Undo (at most five). Read by the toast's Undo later,
  // so it is a ref, and so is the page's latest state.
  const undoStack = useRef<Recipe[]>([]);
  const latest = useRef(shown);
  useEffect(() => {
    latest.current = shown;
  });
  const [sheet, setSheet] = useState<{ kind: 'swap'; index: number } | { kind: 'add' } | null>(null);
  // Bumped on every open, so a sheet starts with an empty field.
  const [opened, setOpened] = useState(0);
  const [updating, setUpdating] = useState(false);
  // The edit chosen in a sheet waits for the sheet to finish closing before it asks, so the wait never opens under it.
  const pending = useRef<RecipeChange | null>(null);
  const running = useRef<AbortController | null>(null);
  const showToast = useToast();

  useEffect(() => () => running.current?.abort(), []);

  if (!shown) {
    return (
      <Screen>
        <BackHeader />
        <View style={styles.missing}>
          <AppText variant="displaySmall">That recipe is gone</AppText>
          <AppText color="inkSoft">Ask Bellie for new ideas in the Kitchen.</AppText>
        </View>
      </Screen>
    );
  }

  const { recipe, cuisine, saved } = shown;

  const toggleSaved = () => {
    try {
      if (saved) {
        removeSavedRecipe(db, saved.id);
        setShown({ ...shown, saved: null });
      } else {
        setShown({ ...shown, saved: saveRecipe(db, recipe, cuisine) });
      }
      setFailed(false);
    } catch (error) {
      logger.error('toggleSavedRecipe', error);
      setFailed(true);
      return;
    }
    Haptics.selectionAsync().catch(() => {});
  };

  /** Puts a version in place, and in the saved list when this recipe is saved there. */
  const place = (next: Recipe) => {
    const current = latest.current;
    if (!current) return;
    if (current.saved) updateSavedRecipe(db, current.saved.id, next);
    setShown({
      ...current,
      recipe: next,
      saved: current.saved ? { ...current.saved, recipe: next } : null,
    });
  };

  const edit = async (change: RecipeChange) => {
    const controller = new AbortController();
    running.current = controller;
    setUpdating(true);
    try {
      const request = buildAdjustRequest(db, {
        recipe,
        change,
        conditions: getSetting(db, 'conditions'),
      });
      const changed = await adjustRecipe(request, controller.signal);
      if (controller.signal.aborted) return;
      // The picture is the phone's own, so the dish keeps it through every edit.
      place(recipe.look === undefined ? changed : { ...changed, look: recipe.look });
      undoStack.current = pushUndo(undoStack.current, recipe);
      setFailed(false);
      showToast('Recipe updated', { action: { label: 'Undo', onPress: undoEdit } });
    } catch (error) {
      if (controller.signal.aborted) return;
      logger.error('adjustRecipe', error);
      const code: ErrorCode = error instanceof AppError ? error.code : 'INTERNAL';
      showToast(editErrorMessage(code));
    } finally {
      setUpdating(false);
    }
  };

  const undoEdit = () => {
    const previous = undoStack.current[undoStack.current.length - 1];
    if (!previous) return;
    try {
      place(previous);
      undoStack.current = undoStack.current.slice(0, -1);
    } catch (error) {
      logger.error('undoRecipeEdit', error);
      setFailed(true);
      return;
    }
    Haptics.selectionAsync().catch(() => {});
  };

  const chooseEdit = (change: RecipeChange) => {
    pending.current = change;
    setSheet(null);
  };
  const afterSheet = () => {
    const change = pending.current;
    pending.current = null;
    if (change) void edit(change);
  };
  const openSheet = (next: NonNullable<typeof sheet>) => {
    setOpened((count) => count + 1);
    setSheet(next);
  };
  const swapping = sheet?.kind === 'swap' ? (recipe.ingredients[sheet.index] ?? '') : '';

  const rate = (value: 'up' | 'down') => {
    if (!saved) return;
    const next = saved.rating === value ? null : value;
    try {
      setRecipeRating(db, saved.id, next);
      setShown({ ...shown, saved: { ...saved, rating: next } });
    } catch (error) {
      logger.error('setRecipeRating', error);
      setFailed(true);
      return;
    }
    Haptics.selectionAsync().catch(() => {});
  };

  return (
    <Screen style={styles.screen}>
      <BackHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <RecipeArt look={lookFor(recipe)} height={200} />

        <View style={styles.heading}>
          <AppText variant="displaySmall" accessibilityRole="header">
            {recipe.title}
          </AppText>
          <AppText variant="subtitle" color="inkSoft">
            {recipeMeta(recipe)}
          </AppText>
          <View style={[styles.tag, { backgroundColor: colors.sageTint }]}>
            <Leaf size={14} color={colors.sageInk} strokeWidth={2} />
            <AppText variant="label" color="sageInk">
              Gentle
            </AppText>
          </View>
        </View>

        {/* One white card, dark titles on white: coloured text on a coloured box was hard to read (Figma 29e). */}
        <View style={[styles.card, styles.whyCard, { backgroundColor: colors.surface }]}>
          <View style={styles.whyBlock}>
            <View style={styles.whyHeader}>
              <View style={[styles.whyIcon, { backgroundColor: colors.sageTint }]}>
                <Leaf size={20} color={colors.sageInk} strokeWidth={2} />
              </View>
              <AppText variant="section" accessibilityRole="header">
                Why it&apos;s gentle
              </AppText>
            </View>
            <AppText>{recipe.why}</AppText>
          </View>
          {recipe.tip.length > 0 && (
            <View style={styles.whyBlock}>
              <View style={styles.whyHeader}>
                <View style={[styles.whyIcon, { backgroundColor: colors.honeyTint }]}>
                  <Lightbulb size={20} color={colors.honeyInk} strokeWidth={2} />
                </View>
                <AppText variant="section" accessibilityRole="header">
                  Belly tip
                </AppText>
              </View>
              <AppText>{recipe.tip}</AppText>
            </View>
          )}
        </View>

        {/* Opens and closes from its header (Figma 29e2). It always starts open: you need it before you cook. */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ingredients, ${recipe.ingredients.length} items`}
            accessibilityHint={open ? 'Closes the list' : 'Opens the list'}
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen((value) => !value)}
            style={styles.cardHeader}>
            <AppText variant="section" style={styles.fill}>
              Ingredients
            </AppText>
            <AppText variant="caption" color="inkMuted">
              {open ? `for ${recipe.serves}` : `${recipe.ingredients.length} items · for ${recipe.serves}`}
            </AppText>
            {open ? (
              <ChevronUp size={24} color={colors.inkMuted} strokeWidth={2} />
            ) : (
              <ChevronDown size={24} color={colors.inkMuted} strokeWidth={2} />
            )}
          </Pressable>
          {open && (
            <IngredientGrid
              ingredients={recipe.ingredients}
              onSwap={(index) => openSheet({ kind: 'swap', index })}
              onRemove={(index) => void edit({ kind: 'remove', ingredient: recipe.ingredients[index] ?? '' })}
              onAdd={() => openSheet({ kind: 'add' })}
            />
          )}
        </View>

        <View style={styles.steps}>
          <AppText variant="section" accessibilityRole="header">
            Steps
          </AppText>
          <SnapCards
            items={recipe.steps}
            keyOf={(step, index) => `${step}-${index}`}
            labelOf={(step, index) => `Step ${index + 1} of ${recipe.steps.length}: ${step}`}
            renderItem={(step, index) => <StepCard index={index} total={recipe.steps.length} text={step} />}
          />
        </View>

        <View style={styles.actions}>
          <View style={styles.fill}>
            <Button
              label={saved ? 'Saved' : 'Save'}
              variant="secondary"
              icon={saved ? Check : Bookmark}
              onPress={toggleSaved}
              accessibilityHint={saved ? 'Takes it off your saved recipes' : 'Keeps it in your saved recipes'}
            />
          </View>
          <View style={styles.fill}>
            <Button
              label="Log this meal"
              onPress={() => router.push({ pathname: '/log/food', params: { prefill: recipe.title } })}
            />
          </View>
        </View>

        {failed && (
          <AppText color="redInk" style={styles.note}>
            {friendlyMessages.INTERNAL}
          </AppText>
        )}

        {saved && (
          <View style={styles.rate}>
            <AppText color="inkSoft" style={styles.fill}>
              How was it?
            </AppText>
            <Thumb label="Liked it" icon={ThumbsUp} on={saved.rating === 'up'} onPress={() => rate('up')} />
            <Thumb
              label="Not for me"
              icon={ThumbsDown}
              on={saved.rating === 'down'}
              onPress={() => rate('down')}
            />
          </View>
        )}

        <AppText variant="caption" color="inkMuted" style={styles.note}>
          Ideas, not medical advice.
        </AppText>
      </ScrollView>

      <SwapSheet
        key={`swap-${opened}`}
        visible={sheet?.kind === 'swap'}
        ingredient={swapping}
        onClose={() => setSheet(null)}
        onDismissed={afterSheet}
        onSubmit={(replacement) =>
          chooseEdit({ kind: 'swap', ingredient: swapping, ...(replacement ? { with: replacement } : {}) })
        }
      />
      <AddIngredientsSheet
        key={`add-${opened}`}
        visible={sheet?.kind === 'add'}
        onClose={() => setSheet(null)}
        onDismissed={afterSheet}
        onSubmit={(ingredients) => chooseEdit({ kind: 'add', ingredients })}
      />
      <UpdatingModal visible={updating} />
    </Screen>
  );
}

/** The recipe to show: a saved one by id, or the one just picked from the ideas. Null when neither is there. */
function load(db: AppDb, savedParam: string | undefined): Shown | null {
  try {
    if (savedParam) {
      const stored = getSavedRecipe(db, Number(savedParam));
      return stored ? { recipe: stored.recipe, cuisine: stored.cuisine, saved: stored } : null;
    }
    const draft = getRecipeDraft();
    if (!draft) return null;
    return {
      recipe: draft.recipe,
      cuisine: draft.cuisine,
      saved: findSavedRecipe(db, draft.recipe.title, draft.cuisine),
    };
  } catch (error) {
    logger.error('loadRecipe', error);
    return null;
  }
}

function Thumb({
  label,
  icon: Icon,
  on,
  onPress,
}: {
  label: string;
  icon: typeof ThumbsUp;
  on: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.thumb, { backgroundColor: on ? colors.sageTint : colors.surface }]}>
      <Icon size={20} color={on ? colors.sageInk : colors.ink} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  content: { paddingTop: space.s2, paddingBottom: space.s5, gap: space.s3 },
  fill: { flex: 1 },
  missing: { flex: 1, justifyContent: 'center', gap: space.s1 },
  heading: { gap: space.s1 },
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  whyCard: { gap: space.s3 },
  whyBlock: { gap: space.s1 },
  whyHeader: { flexDirection: 'row', alignItems: 'center', gap: space.s1 + 4 },
  whyIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { borderRadius: radius.lg, padding: space.s2, gap: space.s1 },
  // The whole header is the button that opens and closes the list, so it is at least a thumb tall.
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: space.s1, minHeight: minTouchTarget },
  steps: { gap: space.s1 + 4 },
  actions: { flexDirection: 'row', gap: space.s1 + 4 },
  rate: { flexDirection: 'row', alignItems: 'center', gap: space.s1 + 4 },
  thumb: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { textAlign: 'center' },
});
