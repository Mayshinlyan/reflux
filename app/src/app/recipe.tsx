import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Bookmark, Check, Leaf, ThumbsDown, ThumbsUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { CuisineArt } from '@/components/kitchen/CuisineArt';
import { Screen } from '@/components/Screen';
import type { CuisineKey } from '@/constants/cuisines';
import { useDb } from '@/db/DatabaseProvider';
import {
  findSavedRecipe,
  getSavedRecipe,
  removeSavedRecipe,
  saveRecipe,
  setRecipeRating,
  type StoredRecipe,
} from '@/db/repositories/savedRecipes';
import type { AppDb } from '@/db/types';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { recipeMeta } from '@/lib/recipe';
import { getRecipeDraft } from '@/lib/recipeDraft';
import { minTouchTarget, radius, space, useColors } from '@/theme';
import type { Recipe } from '@/types/recipe';

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
        <CuisineArt cuisine={cuisine} height={200} />

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

        <View style={[styles.why, { backgroundColor: colors.sageTint }]}>
          <View style={styles.whyBlock}>
            <AppText variant="label" color="sageInk">
              Why it&apos;s gentle
            </AppText>
            <AppText variant="subtitle">{recipe.why}</AppText>
          </View>
          {recipe.tip.length > 0 && (
            <View style={styles.whyBlock}>
              <AppText variant="label" color="sageInk">
                Belly tip
              </AppText>
              <AppText variant="subtitle">{recipe.tip}</AppText>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.cardHeader}>
            <AppText variant="section" accessibilityRole="header" style={styles.fill}>
              Ingredients
            </AppText>
            <AppText variant="caption" color="inkMuted">{`for ${recipe.serves}`}</AppText>
          </View>
          {recipe.ingredients.map((item, index) => (
            <View key={`${item}-${index}`} style={styles.ingredient}>
              <View style={[styles.dot, { backgroundColor: colors.surface2 }]} />
              <AppText style={styles.fill}>{item}</AppText>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <AppText variant="section" accessibilityRole="header">
            Steps
          </AppText>
          {recipe.steps.map((step, index) => (
            <View key={`${step}-${index}`} style={styles.step}>
              <View style={[styles.number, { backgroundColor: colors.surface2 }]}>
                <AppText variant="label" accessibilityLabel={`Step ${index + 1}`}>
                  {index + 1}
                </AppText>
              </View>
              <AppText style={styles.fill}>{step}</AppText>
            </View>
          ))}
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
  why: { borderRadius: radius.md, padding: space.s2, gap: space.s1 + 4 },
  whyBlock: { gap: 4 },
  card: { borderRadius: radius.lg, padding: space.s2, gap: space.s1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  ingredient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1 + 4,
    minHeight: 36,
    paddingLeft: 4,
  },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s1 + 4 },
  number: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
