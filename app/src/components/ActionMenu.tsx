import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, shadow, space, typography, useColors } from '@/theme';

import { AppText } from './AppText';

export type ActionMenuItem = {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  /** Red label and icon, for delete. */
  destructive?: boolean;
};

/** Figma "Action menu": a floating `surface` card of icon + label rows (edit, delete...). */
export function ActionMenu({ items }: { items: ActionMenuItem[] }) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="menu"
      style={[styles.menu, { backgroundColor: colors.surface, boxShadow: shadow.softLift }]}>
      {items.map(({ label, icon: Icon, onPress, destructive }) => {
        const color = destructive ? colors.redInk : colors.ink;
        return (
          <Pressable
            key={label}
            accessibilityRole="menuitem"
            accessibilityLabel={label}
            onPress={onPress}
            style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surface2 }]}>
            <Icon size={20} color={color} strokeWidth={2} />
            <AppText style={[styles.label, { color }]}>{label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: { width: 232, padding: 8, borderRadius: radius.lg },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1_5,
    minHeight: 44,
    paddingHorizontal: space.s1_5,
    paddingVertical: 10,
    borderRadius: 12,
  },
  label: typography.bodyEm,
});
