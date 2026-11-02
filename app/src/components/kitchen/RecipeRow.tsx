import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { CUISINE_TINT, type CuisineKey } from '@/constants/cuisines';
import { recipeMeta } from '@/lib/recipe';
import { radius, space, useColors } from '@/theme';
import type { Recipe } from '@/types/recipe';

type Props = {
  recipe: Recipe;
  cuisine: CuisineKey;
  onPress: () => void;
};

/** One saved recipe on the Kitchen page (Figma row 29a): a small Bellie on the cuisine's colour, the name and the time. */
export function RecipeRow({ recipe, cuisine, onPress }: Props) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${recipe.title}, ${recipeMeta(recipe)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.thumb, { backgroundColor: colors[CUISINE_TINT[cuisine]] }]}>
        <Belly mood="happy" size={30} />
      </View>
      <View style={styles.text}>
        <AppText numberOfLines={1}>{recipe.title}</AppText>
        <AppText variant="caption" color="inkMuted">
          {recipeMeta(recipe)}
        </AppText>
      </View>
      <ChevronRight size={20} color={colors.inkSoft} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1 + 4,
    paddingHorizontal: space.s1 + 4,
    paddingVertical: space.s1,
    borderRadius: radius.md,
  },
  thumb: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
});
