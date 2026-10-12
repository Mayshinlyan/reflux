import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { minTouchTarget, radius, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = {
  label: string;
  value?: string;
  onPress: () => void;
  /** Optional leading icon (Figma "List row"). */
  icon?: LucideIcon;
  /** Red label and icon, for destructive rows; the chevron is dropped. */
  danger?: boolean;
};

/** A tappable row on the Settings screen: a filled `surface` card, no outline. */
export function SettingsRow({ label, value, onPress, icon: Icon, danger = false }: Props) {
  const colors = useColors();
  const color = danger ? colors.redInk : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]}>
      {Icon && <Icon size={22} color={color} strokeWidth={2} />}
      <AppText style={[styles.label, { color }]}>{label}</AppText>
      {value ? (
        <AppText variant="caption" color="inkSoft">
          {value}
        </AppText>
      ) : null}
      {!danger && <ChevronRight size={18} color={colors.inkSoft} strokeWidth={2} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: Math.max(minTouchTarget, 52),
    borderRadius: radius.md,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  label: { flex: 1, fontSize: 16 },
});
