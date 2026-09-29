import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, space, typography, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  /** 'primary' = the terracotta Log button; 'default' = white Scan button; 'menu' = small pet-menu item. */
  variant?: 'primary' | 'default' | 'menu';
  accessibilityHint?: string;
};

/** Round floating button with a label underneath, from the mockup's Today screen. */
export function CircleActionButton({
  label,
  icon: Icon,
  onPress,
  variant = 'default',
  accessibilityHint,
}: Props) {
  const colors = useColors();
  const primary = variant === 'primary';
  const menu = variant === 'menu';
  const size = menu ? 50 : 58;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      hitSlop={menu ? 6 : 0}
      style={({ pressed }) => [styles.button, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            backgroundColor: primary ? colors.cta : colors.surface,
            borderColor: primary ? colors.cta : colors.hairline,
            borderWidth: menu ? 0 : 1.5,
            shadowColor: primary ? colors.cta : colors.ink,
            shadowOpacity: menu ? 0.28 : primary ? 0.45 : 0.18,
          },
        ]}>
        <Icon size={menu ? 21 : 22} color={primary ? colors.ctaInk : colors.ink} strokeWidth={2.2} />
      </View>
      <AppText
        style={[
          menu ? styles.menuLabel : styles.label,
          menu && { backgroundColor: colors.surface, shadowColor: colors.ink },
        ]}>
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
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  label: typography.label,
  menuLabel: {
    ...typography.label,
    fontSize: 11,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
});
