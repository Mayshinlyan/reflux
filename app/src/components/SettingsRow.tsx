import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { minTouchTarget, radius, space, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = { label: string; value?: string; onPress: () => void };

/** A tappable row on the Settings screen (the mockup's `.settings-row`). */
export function SettingsRow({ label, value, onPress }: Props) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.hairline, opacity: pressed ? 0.85 : 1 },
      ]}>
      <AppText style={styles.label}>{label}</AppText>
      {value ? (
        <AppText variant="caption" color="inkSoft">
          {value}
        </AppText>
      ) : null}
      <ChevronRight size={18} color={colors.inkSoft} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    minHeight: Math.max(minTouchTarget, 52),
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.s2,
    marginBottom: space.s1,
  },
  label: { flex: 1, fontSize: 16 },
});
