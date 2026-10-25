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
 * summary, the triggers that matched, a "Better next time" tip, and why. The pieces are exported so a logged
 * meal's page (Figma "04b.1") can show the same verdict.
 */
export function FoodVerdict({ analysis, late }: Props) {
  return (
    <View style={styles.wrap}>
      <VerdictHero analysis={analysis} late={late} />
      <VerdictTip tip={analysis.overall.tip} />
      <VerdictWhy analysis={analysis} late={late} />
      <AppText variant="caption" color="inkSoft">
        For tracking only, not medical advice. Food results are AI-generated.
      </AppText>
    </View>
  );
}

/**
 * The belly's mood under a bubble with the verdict, the badge, the AI's one-line summary and (unless the screen
 * shows them elsewhere) the matched triggers. All centred.
 */
export function VerdictHero({ analysis, late, showTriggers = true }: Props & { showTriggers?: boolean }) {
  const verdict = effectiveVerdict(analysis);
  const triggers = showTriggers ? matchedTriggerLabels(analysis, { late }) : [];
  const { summary } = analysis.overall;
  return (
    <View style={styles.hero}>
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
  );
}

/** "Better next time": the AI's tip in a sage-tint card; nothing when there is none. */
export function VerdictTip({ tip }: { tip?: string }) {
  const colors = useColors();
  if (!tip) return null;
  return (
    <View style={[styles.card, { backgroundColor: colors.sageTint }]}>
      <AppText variant="sectionSm">Better next time</AppText>
      <AppText variant="small">{tip}</AppText>
    </View>
  );
}

/**
 * "Why we think so": the reasons and key ingredients. A `surface` card by default; `plain` drops the card for
 * screens that already sit it on one.
 */
export function VerdictWhy({ analysis, late, plain = false }: Props & { plain?: boolean }) {
  const colors = useColors();
  const reasons = verdictReasons(analysis, { late });
  const ingredients = uniqueIngredients(analysis);
  if (reasons.length === 0 && ingredients.length === 0) return null;
  return (
    <View
      style={
        plain
          ? styles.plain
          : [styles.card, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.edge }]
      }>
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
  hero: { gap: space.s1_5, alignItems: 'center' },
  // The badge starts at the left of its row by default; this screen is centred.
  badge: { alignSelf: 'center' },
  summary: { textAlign: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.s1 },
  card: { borderRadius: radius.lg, padding: space.s2, gap: space.s1_5 },
  plain: { gap: space.s1_5 },
  reason: { flexDirection: 'row', gap: space.s1_5, alignItems: 'flex-start' },
  // Sits on the first line's x-height, like the Figma bullet.
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  reasonText: { flex: 1 },
});
