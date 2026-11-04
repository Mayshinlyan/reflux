import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { cardEdge, minTouchTarget, radius, space, useColors } from '@/theme';

type Props = {
  icon: ReactNode;
  label: string;
  /** A number in a filled oval after the label; left out when 0 or missing. */
  count?: number;
  disabled?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
};

/**
 * One of the two white pills under the Kitchen's saved recipes ("Saved" and "AI Ideas", Figma 38a): a bare icon, the
 * label and, for AI Ideas, the number of ideas waiting in a filled oval. Both share the card's soft edge.
 */
export function PillButton({
  icon,
  label,
  count,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  onPress,
}: Props) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: colors.surface,
          ...cardEdge(colors),
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}>
      {icon}
      <AppText variant="bodyEm" numberOfLines={1}>
        {label}
      </AppText>
      {!!count && (
        <View style={[styles.count, { backgroundColor: colors.cta }]}>
          <AppText variant="label" color="ctaInk">
            {count}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: minTouchTarget,
    borderRadius: radius.pill,
    paddingHorizontal: space.s1_5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s1,
  },
  count: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
