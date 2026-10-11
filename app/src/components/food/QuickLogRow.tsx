import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { TagChip } from '@/components/TagChip';
import { space, useColors } from '@/theme';

export type QuickFood = { id: number; name: string };

type Props = {
  foods: QuickFood[];
  onPick: (id: number) => void;
  onSeeAll: () => void;
};

/** Figma "03b" Quick log: your saved foods as one scrolling line of chips, "See all" at the top right. */
export function QuickLogRow({ foods, onPick, onSeeAll }: Props) {
  const colors = useColors();
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <AppText variant="label" color="inkSoft" accessibilityRole="header">
          Quick log
        </AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="See all" onPress={onSeeAll} hitSlop={10}>
          <AppText variant="label" style={{ color: colors.clayInk }}>
            See all
          </AppText>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginBottom: space.s2 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', gap: space.s1 },
});
