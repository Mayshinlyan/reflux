import { StyleSheet, View } from 'react-native';

import type { WeekDay } from '@/lib/week';
import { radius, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = {
  days: WeekDay[];
  /** Day keys with at least one entry. */
  loggedDays: ReadonlySet<string>;
};

/** Figma "Week strip": this week, Sunday to Saturday. Today is an olive circle; a dot marks a day with entries. */
export function WeekStrip({ days, loggedDays }: Props) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      {days.map((day) => {
        const logged = loggedDays.has(day.key);
        return (
          <View
            key={day.key}
            style={styles.day}
            accessible
            accessibilityLabel={`${day.isToday ? 'Today, ' : ''}${day.name} ${day.date}${logged ? ', has entries' : ''}`}>
            <AppText variant="caption" color="inkSoft">
              {day.letter}
            </AppText>
            <View style={[styles.date, day.isToday && { backgroundColor: colors.cta }]}>
              <AppText variant="label" style={day.isToday ? { color: colors.ctaInk } : undefined}>
                {day.date}
              </AppText>
            </View>
            <View style={[styles.dot, logged && { backgroundColor: colors.sage }]} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  day: { flex: 1, alignItems: 'center', gap: 6 },
  date: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: radius.pill },
});
