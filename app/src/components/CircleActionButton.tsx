import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, shadow, space, typography, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  /** 'primary' = the terracotta Log button; 'default' = white Scan button; 'menu' = small pet-menu item. */
  variant?: 'primary' | 'default' | 'menu';
  /** Bigger circle (76) for screens where the buttons are the main choice. */
  large?: boolean;
  accessibilityHint?: string;
};

/** Round floating button with a label underneath, from the mockup's Today screen. */
export function CircleActionButton({
  label,
  icon: Icon,
  onPress,
  variant = 'default',
  large = false,
  accessibilityHint,
}: Props) {
  const colors = useColors();
  const primary = variant === 'primary';
  const menu = variant === 'menu';
  const size = menu ? 50 : large ? 76 : 58;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      hitSlop={menu ? 6 : 0}
      style={({ pressed }) => [styles.button, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
      <View
        testID="action-circle"
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            // Filled, no outline; the one soft-lift shadow lifts it off the page.
            backgroundColor: primary ? colors.cta : colors.surface,
            boxShadow: shadow.softLift,
          },
        ]}>
        <Icon
          size={menu ? 21 : large ? 30 : 22}
          color={primary ? colors.ctaInk : colors.ink}
          strokeWidth={2.2}
        />
      </View>
      <AppText style={[menu ? styles.menuLabel : styles.label, menu && { backgroundColor: colors.surface }]}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', gap: space.s1 },
  circle: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: typography.label,
  menuLabel: {
    ...typography.label,
    fontSize: 11,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});
