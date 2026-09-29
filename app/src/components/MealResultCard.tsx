import { StyleSheet, View } from 'react-native';

import type { MealAnalysis } from '@/types/analysis';
import { radius, space, useColors } from '@/theme';

import { AppText } from './AppText';
import { VerdictBadge } from './VerdictBadge';

/** A meal analysis: the overall verdict and reasoning, then each item with its own verdict. */
export function MealResultCard({ analysis }: { analysis: MealAnalysis }) {
  const colors = useColors();
  return (
    <View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
        <AppText variant="title" accessibilityRole="header">
          {analysis.mealName}
        </AppText>
        <VerdictBadge verdict={analysis.overall.verdict} />
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
          {item.ingredients.length > 0 && (
            <AppText variant="caption" color="inkSoft">
              {item.ingredients.map((ingredient) => ingredient.name).join(', ')}
            </AppText>
          )}
          <AppText variant="caption" color="inkSoft">
            {item.reasoning}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.s2, gap: space.s1, marginBottom: space.s1 },
  item: { borderWidth: 1, borderRadius: radius.md, padding: space.s2, gap: 4, marginBottom: space.s1 },
  itemHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s1 },
  itemName: { flex: 1 },
});
