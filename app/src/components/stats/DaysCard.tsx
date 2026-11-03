import { StyleSheet, View } from 'react-native';

import { addDays, longDayLabel } from '@/lib/localDay';
import { calmComparison, calmHeadline, type DayStat, type PeriodStats } from '@/lib/statsCards';
import { space, useColors } from '@/theme';

import { AppText } from '../AppText';
import { DayAvatar } from './DayAvatar';
import { StatCard, StatHeader } from './StatCard';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEK_AVATAR = 36;
const MONTH_AVATAR = 34;

/** What a day says in words, for the row under its name and for a screen reader. */
export function dayText(day: DayStat): string {
  if (day.state === 'none') return 'Nothing logged';
  if (day.state === 'calm') return 'No symptoms logged';
  return day.symptoms.join(', ');
}

/**
 * Figma row 28a and 28e: how the shown week or month went. A week is a list, newest first, each day a Bellie on a
 * coloured disc with what was logged; a month is a calendar of the same discs. The header counts the days
 * without symptoms and says how that compares with the last week or month.
 */
export function DaysCard({ stats, width, height }: { stats: PeriodStats; width: number; height: number }) {
  const unit = stats.unit ?? 'week';
  return (
    <StatCard width={width} height={height} gap={space.s1_5}>
      <StatHeader
        title={calmHeadline(stats.days)}
        aside={calmComparison(stats.days, stats.previousDays, unit)}
      />
      {unit === 'week' ? <WeekList days={stats.days} /> : <MonthGrid stats={stats} />}
    </StatCard>
  );
}

function WeekList({ days }: { days: DayStat[] }) {
  const colors = useColors();
  const newestFirst = [...days].reverse();
  return (
    <View>
      {newestFirst.map((day, index) => {
        const label = longDayLabel(day.dayKey);
        return (
          <View
            key={day.dayKey}
            accessible
            accessibilityLabel={`${label}, ${dayText(day)}`}
            style={[
              styles.row,
              index < newestFirst.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.hairline },
            ]}>
            <DayAvatar state={day.state} size={WEEK_AVATAR} />
            <View style={styles.rowText}>
              <AppText>{label}</AppText>
              <AppText variant="caption" color="inkSoft" numberOfLines={2}>
                {dayText(day)}
              </AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function MonthGrid({ stats }: { stats: PeriodStats }) {
  const byDay = new Map(stats.days.map((day) => [day.dayKey, day]));
  // Pad the first week up to the day the month starts on (Sunday first, like the week strip).
  const firstWeekday = new Date(`${stats.period.startKey}T12:00:00`).getDay();
  const cells: (string | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let key = stats.period.startKey; key <= stats.period.endKey; key = addDays(key, 1)) cells.push(key);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  return (
    <View style={styles.grid}>
      <View style={styles.week} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {WEEKDAYS.map((letter, i) => (
          <View key={i} style={styles.cell}>
            <AppText variant="label" color="inkMuted">
              {letter}
            </AppText>
          </View>
        ))}
      </View>
      {weeks.map((week, w) => (
        <View key={w} style={styles.week}>
          {week.map((key, i) => {
            const day = key ? byDay.get(key) : undefined;
            return (
              <View
                key={key ?? `blank-${i}`}
                style={styles.cell}
                accessible={Boolean(day)}
                accessibilityLabel={key && day ? `${longDayLabel(key)}, ${dayText(day)}` : undefined}>
                {key ? (
                  <>
                    {day ? (
                      <DayAvatar state={day.state} size={MONTH_AVATAR} />
                    ) : (
                      <View style={styles.spacer} />
                    )}
                    <AppText variant="caption" color="inkMuted">
                      {String(Number(key.slice(8)))}
                    </AppText>
                  </>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // 6 above and below each row, and a hairline between rows (Figma row 28a).
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s1_5, paddingVertical: 6 },
  rowText: { flex: 1 },
  grid: { gap: 6 },
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', gap: 2 },
  spacer: { width: MONTH_AVATAR, height: MONTH_AVATAR },
});
