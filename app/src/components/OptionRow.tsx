import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { minTouchTarget, radius, space, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = { label: string; selected: boolean; onPress: () => void };

/** Figma "Option row": a filled `surface` row with a radio, the chosen one in clay tint (option sheets, reminder timing). */
export function OptionRow({ label, selected, onPress }: Props) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: selected ? colors.clayTint : colors.surface, opacity: pressed ? 0.85 : 1 },
      ]}>
      <AppText variant="bodyEm" style={styles.label}>
        {label}
      </AppText>
      {/* The radio ring is a functional stroke; chosen, it fills with clay. */}
      <View
        style={[
          styles.radio,
          selected ? { backgroundColor: colors.clay } : { borderWidth: 1.5, borderColor: colors.inkSoft },
        ]}>
        {selected && <Check size={16} color={colors.surface} strokeWidth={2} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: Math.max(minTouchTarget, 52),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingHorizontal: space.s2,
    borderRadius: radius.lg,
  },
  label: { flex: 1 },
  radio: { width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
