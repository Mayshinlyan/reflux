import { Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { cardEdge, radius, space, useColors } from '@/theme';

import { AppText } from './AppText';

/** Figma "Add row": a filled `surface` row with a sage plus circle, for adding to a list ("Add a medication"). */
export function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          ...cardEdge(colors),
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <View style={[styles.plus, { backgroundColor: colors.sageTint }]}>
        <Plus size={20} color={colors.ink} strokeWidth={2} />
      </View>
      <AppText variant="bodyEm">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1_5,
    padding: space.s1_5,
    borderRadius: radius.lg,
  },
  plus: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
