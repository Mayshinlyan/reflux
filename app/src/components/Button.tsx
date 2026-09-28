import { Pressable, StyleSheet } from 'react-native';

import { minTouchTarget, radius, space, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  accessibilityHint?: string;
};

export function Button({ label, onPress, variant = 'primary', disabled, accessibilityHint }: Props) {
  const colors = useColors();
  const primary = variant === 'primary';
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
          backgroundColor: primary ? colors.cta : colors.surface,
          borderColor: primary ? colors.cta : colors.hairline,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}>
      <AppText variant="button" style={{ color: primary ? colors.ctaInk : colors.ink }}>
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
