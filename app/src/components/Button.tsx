import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { usePressScale } from '@/hooks/usePressScale';
import { type ColorToken, minTouchTarget, radius, space, useColors } from '@/theme';

import { AppText } from './AppText';

/**
 * `quietDanger` is a plain red text button for destructive actions that shouldn't compete with the main one;
 * `quiet` is the same in clay ink, for a way out that sits under a primary button ("No symptoms").
 */
type Variant = 'primary' | 'secondary' | 'danger' | 'quietDanger' | 'quiet';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** Optional leading icon, drawn in the label colour. */
  icon?: LucideIcon;
  disabled?: boolean;
  accessibilityHint?: string;
};

// Filled, never outlined: secondary is a `surface2` fill, danger a `redTint` fill.
const VARIANTS: Record<Variant, { bg: ColorToken | 'transparent'; text: ColorToken }> = {
  primary: { bg: 'cta', text: 'ctaInk' },
  secondary: { bg: 'surface2', text: 'ink' },
  danger: { bg: 'redTint', text: 'redInk' },
  quietDanger: { bg: 'transparent', text: 'redInk' },
  quiet: { bg: 'transparent', text: 'clayInk' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  disabled,
  accessibilityHint,
}: Props) {
  const colors = useColors();
  const press = usePressScale();
  // Disabled buttons use the mockup's muted fill rather than fading, so the label stays readable.
  const style = disabled
    ? ({ bg: variant === 'quiet' ? 'transparent' : 'surface2', text: 'inkSoft' } as const)
    : VARIANTS[variant];
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={press.pressIn}
        onPressOut={press.pressOut}
        style={({ pressed }) => [
          styles.base,
          {
            backgroundColor: style.bg === 'transparent' ? 'transparent' : colors[style.bg],
            opacity: pressed ? 0.85 : 1,
          },
        ]}>
        {Icon && <Icon size={20} color={colors[style.text]} strokeWidth={2} />}
        <AppText variant="button" style={{ color: colors[style.text] }}>
          {label}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: Math.max(minTouchTarget, 48),
    borderRadius: radius.pill,
    paddingHorizontal: 22,
    paddingVertical: 13,
    flexDirection: 'row',
    gap: space.s1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
