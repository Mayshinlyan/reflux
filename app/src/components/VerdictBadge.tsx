import { BadgeCheck, CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { radius, verdictColors, useColors } from '@/theme';
import type { AppVerdict } from '@/types/analysis';

import { AppText } from './AppText';

export const VERDICT_LABELS: Record<AppVerdict, string> = {
  good: 'OK',
  ok: 'Likely OK',
  caution: 'Caution',
  trigger: 'Likely trigger',
};

/** The icon for each verdict; it always travels with the label. */
export const VERDICT_ICONS = {
  good: BadgeCheck,
  ok: CircleCheck,
  caution: CircleAlert,
  trigger: TriangleAlert,
} as const;

/** Verdict colours are always paired with an icon and a label, never colour alone. */
export function VerdictBadge({ verdict }: { verdict: AppVerdict }) {
  const colors = useColors();
  const { fg, bg } = verdictColors[verdict];
  const Icon = VERDICT_ICONS[verdict];
  return (
    <View
      style={[styles.badge, { backgroundColor: colors[bg] }]}
      accessible
      accessibilityLabel={VERDICT_LABELS[verdict]}>
      <Icon size={16} color={colors[fg]} strokeWidth={2.4} />
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
