import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { mainIngredients } from '@/lib/ingredients';
import { effectiveVerdict } from '@/lib/verdict';
import { minTouchTarget, radius, space, useColors } from '@/theme';
import type { MealAnalysis, MealItem } from '@/types/analysis';

import { AppText } from './AppText';
import { VERDICT_LABELS, VerdictBadge } from './VerdictBadge';

/** A meal analysis: the overall verdict and reasoning, then each item with its own verdict. */
export function MealResultCard({
  analysis,
  showTitle = true,
  action,
}: {
  analysis: MealAnalysis;
  /** Hide the meal name when the screen already shows it as its own heading. */
  showTitle?: boolean;
  /** A small icon control beside the meal name (e.g. the My foods bookmark). */
  action?: ReactNode;
}) {
  const colors = useColors();
  const verdict = effectiveVerdict(analysis);
  return (
    <View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
        {(showTitle || action) && (
          <View style={styles.head}>
            {showTitle && (
              <AppText variant="title" accessibilityRole="header" style={styles.title}>
                {analysis.mealName}
              </AppText>
            )}
            {action}
          </View>
        )}
        <VerdictBadge verdict={verdict} />
        {verdict !== analysis.overall.verdict && (
          <AppText variant="caption" color="inkSoft">
            {`Set by you. The AI said ${VERDICT_LABELS[analysis.overall.verdict]}.`}
          </AppText>
        )}
        <AppText color="inkSoft">{analysis.overall.reasoning}</AppText>
      </View>
      {analysis.items.map((item, index) => (
        <View
          key={`${item.name}-${index}`}
          style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
          <View style={styles.itemHead}>
            <AppText variant="label" style={styles.itemName}>
              {item.name}
            </AppText>
            <VerdictBadge verdict={item.verdict} />
          </View>
          <IngredientLine ingredients={item.ingredients} />
          <AppText variant="caption" color="inkSoft">
            {item.reasoning}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** Main ingredients by default (triggers always included); "Show all" reveals the rest. */
function IngredientLine({ ingredients }: { ingredients: MealItem['ingredients'] }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  if (ingredients.length === 0) return null;

  const { shown, hiddenCount } = mainIngredients(ingredients);
  const visible = expanded ? ingredients : shown;
  return (
    <View>
      <AppText variant="caption" color="inkSoft">
        {expanded || hiddenCount === 0 ? 'Ingredients: ' : 'Main ingredients: '}
        {visible.map((ingredient) => ingredient.name).join(', ')}
      </AppText>
      {hiddenCount > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? 'Show fewer ingredients' : `Show all ${ingredients.length} ingredients`
          }
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
          style={styles.toggle}>
          <AppText variant="caption" style={{ color: colors.cta }}>
            {expanded ? 'Show fewer' : `Show all ${ingredients.length}`}
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { minHeight: minTouchTarget, justifyContent: 'center', alignSelf: 'flex-start' },
  // The action hangs off the top-right corner so it doesn't push the title down.
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end', gap: space.s1 },
  title: { flex: 1 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.s2, gap: space.s1, marginBottom: space.s1 },
  item: { borderWidth: 1, borderRadius: radius.md, padding: space.s2, gap: 4, marginBottom: space.s1 },
  itemHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s1 },
  itemName: { flex: 1 },
});
