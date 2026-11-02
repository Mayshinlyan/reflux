import { Leaf, X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { Button } from '@/components/Button';
import { FoodLoading } from '@/components/FoodLoading';
import { cuisineLabel, type CuisineKey } from '@/constants/cuisines';
import type { ErrorCode } from '@/lib/errors';
import { ideasErrorMessage } from '@/lib/kitchenCopy';
import { recipeMeta } from '@/lib/recipe';
import { lookFor } from '@/lib/recipeLook';
import { minTouchTarget, radius, space, useColors } from '@/theme';
import type { Recipe } from '@/types/recipe';

import { RecipeArt } from './RecipeArt';
import { SnapCards } from './SnapCards';

export type IdeasStatus = 'loading' | 'ready' | 'error';

type Props = {
  status: IdeasStatus;
  cuisine: CuisineKey;
  recipes: readonly Recipe[];
  errorCode?: ErrorCode;
  /** False once today's rounds are used up, so there is no "Generate more". */
  canMore: boolean;
  onStop: () => void;
  onClose: () => void;
  onCook: (recipe: Recipe) => void;
  onMore: () => void;
  onRetry: () => void;
};

/**
 * What the ideas sheet holds after "Get ideas" (Figma row 29c, 29d, 29l): the wait with the existing pot loader, then
 * three cards to swipe with the dots under them and "Generate more", or a short note when it did not work.
 */
export function IdeasPanel({
  status,
  cuisine,
  recipes,
  errorCode,
  canMore,
  onStop,
  onClose,
  onCook,
  onMore,
  onRetry,
}: Props) {
  const colors = useColors();
  // The cuisine names the ideas while they are made and shown ("Korean recipe ideas"); a failed round has none to
  // name, so it is plainly "Recipe ideas".
  const title =
    status === 'error'
      ? 'Recipe ideas'
      : cuisine === 'any'
        ? 'Recipe ideas for you'
        : `${cuisineLabel(cuisine)} recipe ideas`;
  return (
    <View>
      <View style={styles.header}>
        <AppText variant="displaySmall" accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
        {status === 'loading' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop"
            onPress={onStop}
            hitSlop={(minTouchTarget - 34) / 2}
            style={[styles.stop, { backgroundColor: colors.surface2 }]}>
            <AppText variant="label">Stop</AppText>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={(minTouchTarget - 36) / 2}
            style={[styles.close, { backgroundColor: colors.surface }]}>
            <X size={18} color={colors.ink} strokeWidth={2} />
          </Pressable>
        )}
      </View>

      {status === 'loading' && (
        <View style={[styles.waitCard, { backgroundColor: colors.surface }]}>
          <FoodLoading source="recipes" />
          <AppText variant="caption" color="inkMuted" style={styles.center}>
            This usually takes about 15 seconds.
          </AppText>
        </View>
      )}

      {status === 'ready' && <Cards recipes={recipes} canMore={canMore} onCook={onCook} onMore={onMore} />}

      {status === 'error' && (
        <View style={styles.errorBox}>
          <Belly mood="okay" size={88} />
          <AppText variant="displaySmall" style={styles.center}>
            {errorCode === 'RATE_LIMITED' ? 'Kitchen is closed' : "Couldn't get ideas"}
          </AppText>
          <AppText variant="subtitle" color="inkSoft" style={styles.center}>
            {ideasErrorMessage(errorCode ?? 'INTERNAL')}
          </AppText>
          {/* Closed for the day, there is nothing to try again; the X at the top is the way out. */}
          {errorCode !== 'RATE_LIMITED' && (
            <View style={styles.errorActions}>
              <Button label="Try again" onPress={onRetry} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function Cards({
  recipes,
  canMore,
  onCook,
  onMore,
}: Pick<Props, 'recipes' | 'canMore' | 'onCook' | 'onMore'>) {
  const colors = useColors();
  return (
    <View>
      <SnapCards
        items={recipes}
        keyOf={(recipe, index) => `${recipe.title}-${index}`}
        labelOf={(recipe, index) => `Idea ${index + 1} of ${recipes.length}: ${recipe.title}`}
        renderItem={(recipe) => (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <RecipeArt look={lookFor(recipe)} height={168} />
            <AppText variant="displaySmall">{recipe.title}</AppText>
            <AppText variant="subtitle" color="inkSoft">
              {recipeMeta(recipe)}
            </AppText>
            <View style={[styles.tag, { backgroundColor: colors.sageTint }]}>
              <Leaf size={14} color={colors.sageInk} strokeWidth={2} />
              <AppText variant="label" color="sageInk">
                Gentle
              </AppText>
            </View>
            <AppText variant="subtitle" color="inkSoft" numberOfLines={3}>
              {recipe.why}
            </AppText>
            <Button label="Cook this" accessibilityHint={recipe.title} onPress={() => onCook(recipe)} />
          </View>
        )}
      />
      {canMore ? (
        <Button label="Generate more" variant="secondary" onPress={onMore} />
      ) : (
        <AppText variant="caption" color="inkMuted" style={styles.center}>
          That&apos;s today&apos;s ideas. Bellie is back with more tomorrow.
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.s1, marginBottom: space.s2 },
  title: { flex: 1 },
  stop: {
    height: 34,
    paddingHorizontal: space.s2,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  waitCard: { borderRadius: radius.lg, padding: space.s2, gap: space.s1 },
  center: { textAlign: 'center' },
  card: { flex: 1, borderRadius: radius.lg, padding: space.s2, gap: space.s1 + 4 },
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  errorBox: { alignItems: 'center', gap: space.s1 + 4, paddingVertical: space.s1 },
  errorActions: { alignSelf: 'stretch', gap: space.s1, marginTop: space.s1 },
});
