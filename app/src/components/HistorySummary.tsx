import { StyleSheet, View } from 'react-native';

import { type HistorySummary as Summary, SUMMARY_VERDICTS } from '@/lib/historySummary';
import { radius, space, useColors, verdictColors } from '@/theme';

import { AppText } from './AppText';
import { VERDICT_LABELS } from './VerdictBadge';

/**
 * Figma "04a" summary card: the meal count and the days with symptoms, then one bar split by verdict and a
 * legend. The bar is colour, so every verdict also appears in the legend with its name and count.
 */
export function HistorySummary({ summary }: { summary: Summary }) {
  const colors = useColors();
  const counted = SUMMARY_VERDICTS.filter((verdict) => summary.verdicts[verdict] > 0);
  const mealWord = summary.meals === 1 ? 'meal' : 'meals';
  const dayWord = summary.symptomDays === 1 ? 'day' : 'days';
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.top}>
        <AppText variant="title" accessibilityRole="header">{`${summary.meals} ${mealWord}`}</AppText>
        <AppText variant="caption" color="inkSoft">
          {summary.symptomDays === 0 ? 'No symptoms' : `${summary.symptomDays} ${dayWord} with symptoms`}
        </AppText>
      </View>
      <View style={[styles.bar, { backgroundColor: colors.surface2 }]} accessibilityElementsHidden>
        {counted.map((verdict) => (
          <View
            key={verdict}
            style={{
              flex: summary.verdicts[verdict],
              backgroundColor: colors[verdictColors[verdict].accent],
            }}
          />
        ))}
      </View>
      {counted.length > 0 && (
        <View style={styles.legend}>
          {counted.map((verdict) => (
            <View key={verdict} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: colors[verdictColors[verdict].accent] }]} />
              <AppText variant="caption" color="inkSoft">
                {`${VERDICT_LABELS[verdict]} ${summary.verdicts[verdict]}`}
              </AppText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.s2, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.s1 },
  // Segments sit edge to edge with a hairline of gap, as in Figma.
  bar: { flexDirection: 'row', height: 10, borderRadius: radius.pill, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
