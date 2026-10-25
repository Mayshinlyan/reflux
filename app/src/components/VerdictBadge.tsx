import { BadgeCheck, CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react-native';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, verdictColors, useColors } from '@/theme';
import type { AppVerdict } from '@/types/analysis';

import { AppText } from './AppText';

export const VERDICT_LABELS: Record<AppVerdict, string> = {
  good: 'Good',
  ok: 'Okay',
  caution: 'Caution',
  trigger: 'Avoid',
};

/** The icon for each verdict; it always travels with the label. */
export const VERDICT_ICONS = {
  good: BadgeCheck,
  ok: CircleCheck,
  caution: CircleAlert,
  trigger: TriangleAlert,
} as const;

/**
 * Verdict colours are always paired with an icon and a label, never colour alone. It sits at the start of its
 * row; pass `style={{ alignSelf: 'center' }}` where the screen is centred.
 */
export function VerdictBadge({ verdict, style }: { verdict: AppVerdict; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  const { fg, bg } = verdictColors[verdict];
  const Icon = VERDICT_ICONS[verdict];
  return (
    <View
      style={[styles.badge, { backgroundColor: colors[bg] }, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={VERDICT_LABELS[verdict]}>
      <Icon size={16} color={colors[fg]} strokeWidth={2} />
      <AppText variant="label" style={{ color: colors[fg] }}>
        {VERDICT_LABELS[verdict]}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
});
