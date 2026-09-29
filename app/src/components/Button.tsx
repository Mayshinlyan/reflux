import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { type ColorToken, minTouchTarget, radius, space, useColors } from '@/theme';

import { AppText } from './AppText';

/** `quietDanger` is a plain red text button for destructive actions that shouldn't compete with the main one. */
type Variant = 'primary' | 'secondary' | 'danger' | 'quietDanger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** Optional leading icon, drawn in the label colour. */
  icon?: LucideIcon;
  disabled?: boolean;
  accessibilityHint?: string;
};

const VARIANTS: Record<Variant, { bg: ColorToken; border: ColorToken; text: ColorToken }> = {
  primary: { bg: 'cta', border: 'cta', text: 'ctaInk' },
  secondary: { bg: 'surface', border: 'hairline', text: 'ink' },
  danger: { bg: 'redTint', border: 'redTint', text: 'redInk' },
  quietDanger: { bg: 'surface', border: 'surface', text: 'redInk' },
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
  // Disabled buttons use the mockup's muted fill rather than fading, so the label stays readable.
  const style = disabled ? { bg: 'surface2', border: 'surface2', text: 'inkSoft' } : VARIANTS[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: colors[style.bg as ColorToken],
          borderColor: colors[style.border as ColorToken],
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      {Icon && <Icon size={18} color={colors[style.text as ColorToken]} strokeWidth={2.4} />}
      <AppText variant="button" style={{ color: colors[style.text as ColorToken] }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: Math.max(minTouchTarget, 52),
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space.s3,
    flexDirection: 'row',
    gap: space.s1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
