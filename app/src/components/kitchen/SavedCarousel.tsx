import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
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
  const colors = useColors();
  return (
    <SnapCards
      items={items}
      keyOf={(item) => String(item.id)}
      labelOf={(item, index) => `Saved recipe ${index + 1} of ${items.length}: ${item.recipe.title}`}
      renderItem={(item) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.recipe.title}, ${recipeMeta(item.recipe)}`}
          onPress={() => onOpen(item.id)}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: colors.surface, ...cardEdge(colors), opacity: pressed ? 0.9 : 1 },
          ]}>
          <RecipeArt look={lookFor(item.recipe)} height={190} />
          <AppText variant="displaySmall" numberOfLines={2} style={styles.title}>
            {item.recipe.title}
          </AppText>
          <AppText variant="subtitle" color="inkSoft" style={styles.meta}>
            {recipeMeta(item.recipe)}
          </AppText>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: radius.lg, padding: space.s1_5, gap: 2 },
  title: { marginTop: space.s1, paddingHorizontal: space.s1 },
  meta: { paddingHorizontal: space.s1, paddingBottom: space.s1 / 2 },
});
