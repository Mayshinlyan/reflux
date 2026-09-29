import { Pressable, StyleSheet } from 'react-native';

import { type ColorToken, minTouchTarget, radius, space, useColors } from '@/theme';

import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  accessibilityHint?: string;
};

const VARIANTS: Record<Variant, { bg: ColorToken; border: ColorToken; text: ColorToken }> = {
  primary: { bg: 'cta', border: 'cta', text: 'ctaInk' },
  secondary: { bg: 'surface', border: 'hairline', text: 'ink' },
  danger: { bg: 'redTint', border: 'redTint', text: 'redInk' },
};

export function Button({ label, onPress, variant = 'primary', disabled, accessibilityHint }: Props) {
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});
