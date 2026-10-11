import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { TagChip } from '@/components/TagChip';
import { VerdictBadge } from '@/components/VerdictBadge';
import { BELLY_VERDICT_HEADLINE, bellyMoodFor } from '@/lib/belly';
import { effectiveVerdict } from '@/lib/verdict';
import { matchedTriggerLabels, verdictReasons } from '@/lib/verdictReasons';
import { radius, space, useColors } from '@/theme';
import type { MealAnalysis } from '@/types/analysis';

type Props = {
  analysis: MealAnalysis;
  /** "Today, 7:45 PM": when the meal is being logged for. */
  when: string;
  /** Eaten close to bedtime. */
  late: boolean;
};

/** Figma "03c Food: verdict": the belly's mood, a headline, why, and which triggers matched. */
export function FoodVerdict({ analysis, when, late }: Props) {
  const colors = useColors();
  const verdict = effectiveVerdict(analysis);
  const reasons = verdictReasons(analysis, { late });
  const triggers = matchedTriggerLabels(analysis, { late });
  return (
    <View style={styles.wrap}>
      <View style={styles.result}>
        <Belly mood={bellyMoodFor(verdict)} size={80} />
        <VerdictBadge verdict={verdict} />
        <AppText variant="hero" accessibilityRole="header">
          {BELLY_VERDICT_HEADLINE[verdict]}
        </AppText>
        <AppText variant="caption" color="inkSoft">
          {`${analysis.mealName} · ${when}`}
        </AppText>
      </View>
      {reasons.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <AppText variant="section">Why we think so</AppText>
          {reasons.map((reason) => (
            <View key={reason} style={styles.reason}>
              <View style={[styles.dot, { backgroundColor: colors.honey }]} />
              <AppText style={styles.reasonText}>{reason}</AppText>
            </View>
          ))}
        </View>
      )}
      {triggers.length > 0 && (
        <View style={styles.triggers}>
          <AppText variant="section">Matched triggers</AppText>
          <View style={styles.tags}>
            {triggers.map((label) => (
              <TagChip key={label} label={label} selected={false} readOnly />
            ))}
          </View>
        </View>
      )}
      <AppText variant="caption" color="inkSoft">
        For tracking only, not medical advice. Food results are AI-generated.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s2 },
  result: { gap: 16, alignItems: 'flex-start' },
  card: { borderRadius: radius.lg, padding: space.s2, gap: 12 },
  reason: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  // Sits on the first line's x-height, like the Figma bullet.
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 10 },
  reasonText: { flex: 1 },
  triggers: { gap: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1 },
});
