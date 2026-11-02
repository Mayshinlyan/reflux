import { StyleSheet, View } from 'react-native';

import { formatWindow } from '@/lib/clock';
import type { HistorySummary } from '@/lib/historySummary';
import { oftenWith, type PeriodStats, TIMES_OF_DAY, whenTitle } from '@/lib/statsCards';
import { radius, space, useColors } from '@/theme';

import { AppText } from '../AppText';
import { Bars, StatCard, StatHeader } from './StatCard';

type Props = { stats: PeriodStats; summary: HistorySummary; width: number; height: number };

/** "None were followed by symptoms.", "1 was ...", "2 were ...". */
const followed = (count: number) =>
  count === 0
    ? 'None were followed by symptoms.'
    : `${count} ${count === 1 ? 'was' : 'were'} followed by symptoms.`;

/**
 * Figma row 28c: when symptoms showed up (morning, afternoon, evening, night), meals eaten close to bedtime and
 * how many of them had symptoms after, and the lifestyle factors logged most. Replaces Top tags.
 */
export function WhenCard({ stats, summary, width, height }: Props) {
  const colors = useColors();
  const total = TIMES_OF_DAY.reduce((sum, { key }) => sum + stats.byTime[key], 0);
  const often = oftenWith(summary);
  const { late, withSymptoms } = stats.late;
  return (
    <StatCard width={width} height={height} gap={space.s2}>
      <StatHeader
        title={whenTitle(stats.byTime)}
        aside={total === 0 ? 'No symptoms logged' : 'When symptoms showed up'}
      />
      <Bars
        rows={TIMES_OF_DAY.map(({ key, label }) => ({ key, label, count: stats.byTime[key] }))}
        fill="clay"
      />
      {late > 0 && (
        <View
          accessible
          accessibilityLabel={`${late} late ${late === 1 ? 'meal' : 'meals'}. Within ${formatWindow(stats.windowMinutes)} of bedtime. ${followed(withSymptoms)}`}
          style={[styles.late, { backgroundColor: colors.surface2 }]}>
          <AppText variant="bodyEm">{`${late} late ${late === 1 ? 'meal' : 'meals'}`}</AppText>
          <AppText variant="caption" color="inkSoft">
            {`Within ${formatWindow(stats.windowMinutes)} of bedtime. ${followed(withSymptoms)}`}
          </AppText>
        </View>
      )}
      {often ? <AppText variant="voiceSmall">{`Often logged with ${often}.`}</AppText> : null}
    </StatCard>
  );
}

const styles = StyleSheet.create({
  late: { borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: space.s2, gap: 2 },
});
