import { ScrollView, StyleSheet } from 'react-native';

import { TagChip } from '@/components/TagChip';
import { space } from '@/theme';

export type QuickFood = { id: number; name: string };

type Props = {
  foods: QuickFood[];
  onPick: (id: number) => void;
};

/** Figma "21a": your favorite foods as one scrolling line of chips under the field; a tap logs the food at once. */
export function QuickLogRow({ foods, onPick }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel="Favorite foods"
      style={styles.row}
      contentContainerStyle={styles.chips}>
      {foods.map((food) => (
        <TagChip
          key={food.id}
          label={food.name}
          selected={false}
          role="button"
          onPress={() => onPick(food.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexGrow: 0 },
  chips: { flexDirection: 'row', gap: space.s1 },
});
