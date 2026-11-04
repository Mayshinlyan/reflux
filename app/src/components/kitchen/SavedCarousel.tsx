import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { PRESS_SHRINK, usePressScale } from '@/hooks/usePressScale';
import { recipeMeta } from '@/lib/recipe';
import { lookFor } from '@/lib/recipeLook';
import { cardEdge, radius, space, useColors } from '@/theme';
import type { Recipe } from '@/types/recipe';

import { RecipeArt } from './RecipeArt';
import { SnapCards } from './SnapCards';

type Item = { id: number; recipe: Recipe };

/**
 * The saved recipes as cards to swipe, where the "Cook something" card used to be (Figma 38a): each one keeps the
 * picture it was made with, then its name and time, and a tap opens the recipe. The next card peeks in at the edge.
 */
export function SavedCarousel({ items, onOpen }: { items: readonly Item[]; onOpen: (id: number) => void }) {
  return (
    <SnapCards
      items={items}
      keyOf={(item) => String(item.id)}
      labelOf={(item, index) => `Saved recipe ${index + 1} of ${items.length}: ${item.recipe.title}`}
      renderItem={(item) => <SavedCard recipe={item.recipe} onPress={() => onOpen(item.id)} />}
    />
  );
}

/** One saved recipe's card; it shrinks a little under a finger like the app's buttons. */
function SavedCard({ recipe, onPress }: { recipe: Recipe; onPress: () => void }) {
  const colors = useColors();
  const press = usePressScale(PRESS_SHRINK);
  return (
    <Animated.View style={[styles.fill, press.style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${recipe.title}, ${recipeMeta(recipe)}`}
        onPress={onPress}
        onPressIn={press.pressIn}
        onPressOut={press.pressOut}
        style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
        <RecipeArt look={lookFor(recipe)} height={140} />
        <AppText variant="displaySmall" numberOfLines={2} style={styles.title}>
          {recipe.title}
        </AppText>
        <AppText variant="subtitle" color="inkSoft" style={styles.meta}>
          {recipeMeta(recipe)}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  card: { flex: 1, borderRadius: radius.lg, padding: space.s1_5, gap: 2 },
  title: { marginTop: space.s1, paddingHorizontal: space.s1 },
  meta: { paddingHorizontal: space.s1, paddingBottom: space.s1 / 2 },
});
