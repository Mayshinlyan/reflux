import { Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, useColors } from '@/theme';

import { AppText } from './AppText';

/** Figma "Add row": a filled `surface` row with a sage plus circle, for adding to a list ("Add a medication"). */
export function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.plus, { backgroundColor: colors.sageTint }]}>
        <Plus size={18} color={colors.ink} strokeWidth={2.4} />
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
    gap: 12,
    padding: 12,
    borderRadius: radius.lg,
  },
  plus: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
