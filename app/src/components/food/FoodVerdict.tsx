import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { IngredientLine } from '@/components/MealResultCard';
import { SpeechBubble } from '@/components/SpeechBubble';
import { TagChip } from '@/components/TagChip';
import { VerdictBadge } from '@/components/VerdictBadge';
import { BELLY_VERDICT_HEADLINE, bellyMoodFor } from '@/lib/belly';
import { effectiveVerdict } from '@/lib/verdict';
import { matchedTriggerLabels, verdictReasons } from '@/lib/verdictReasons';
import { radius, space, useColors } from '@/theme';
import type { MealAnalysis, MealItem } from '@/types/analysis';

type Props = {
  analysis: MealAnalysis;
  /** Eaten close to bedtime. */
  late: boolean;
};

/**
 * Figma "03c.1 Food: verdict": Bellie under a speech bubble that carries the verdict, then the AI's one-line
 * summary, the triggers that matched, a "Better next time" tip, and why.
 */
export function FoodVerdict({ analysis, late }: Props) {
  const colors = useColors();
  const verdict = effectiveVerdict(analysis);
  const reasons = verdictReasons(analysis, { late });
  const triggers = matchedTriggerLabels(analysis, { late });
  const ingredients = uniqueIngredients(analysis);
  const { summary, tip } = analysis.overall;
  return (
    <View style={styles.wrap}>
      <View style={styles.result}>
        <SpeechBubble card tail="down" text={BELLY_VERDICT_HEADLINE[verdict]} accessibilityRole="header" />
        <Belly mood={bellyMoodFor(verdict)} size={120} />
        <VerdictBadge verdict={verdict} style={styles.badge} />
        {summary ? <AppText style={styles.summary}>{summary}</AppText> : null}
        {triggers.length > 0 && (
          <View style={styles.tags}>
            {triggers.map((label) => (
              <TagChip key={label} label={label} selected={false} readOnly />
            ))}
          </View>
        )}
      </View>
      {tip ? (
        <View style={[styles.card, { backgroundColor: colors.sageTint }]}>
          <AppText variant="sectionSm">Better next time</AppText>
          <AppText variant="small">{tip}</AppText>
        </View>
      ) : null}
      {(reasons.length > 0 || ingredients.length > 0) && (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <AppText variant="sectionSm">Why we think so</AppText>
          {reasons.map((reason) => (
            <View key={reason} style={styles.reason}>
              <View style={[styles.dot, { backgroundColor: colors.honey }]} />
              <AppText variant="small" style={styles.reasonText}>
                {reason}
              </AppText>
            </View>
          ))}
          <IngredientLine ingredients={ingredients} label="Key ingredients" linkColor="clayInk" />
        </View>
      )}
      <AppText variant="caption" color="inkSoft">
        For tracking only, not medical advice. Food results are AI-generated.
      </AppText>
    </View>
  );
}

/** Every ingredient across the meal's items, once each, in the order the relay listed them. */
function uniqueIngredients(analysis: MealAnalysis): MealItem['ingredients'] {
  const seen = new Set<string>();
  return analysis.items
    .flatMap((item) => item.ingredients)
    .filter((ingredient) => {
      const key = ingredient.name.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const styles = StyleSheet.create({
  wrap: { gap: space.s3 },
  result: { gap: 12, alignItems: 'center' },
  // The badge starts at the left of its row by default; this screen is centred.
  badge: { alignSelf: 'center' },
  summary: { textAlign: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.s1 },
  card: { borderRadius: radius.lg, padding: space.s2, gap: 12 },
  reason: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  // Sits on the first line's x-height, like the Figma bullet.
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  reasonText: { flex: 1 },
});
