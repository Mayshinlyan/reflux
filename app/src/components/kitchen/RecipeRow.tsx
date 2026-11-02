import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { recipeMeta } from '@/lib/recipe';
import { LOOKS, lookFor } from '@/lib/recipeLook';
import { radius, space, useColors } from '@/theme';
import type { Recipe } from '@/types/recipe';

type Props = {
  recipe: Recipe;
  onPress: () => void;
};

/** One saved recipe on the Kitchen page (Figma row 29a): a small Bellie on the colour of its picture, the name and the time. */
export function RecipeRow({ recipe, onPress }: Props) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${recipe.title}, ${recipeMeta(recipe)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.thumb, { backgroundColor: colors[LOOKS[lookFor(recipe)]!.tint] }]}>
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
