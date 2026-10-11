import { Pressable, StyleSheet, View } from 'react-native';

import type { WeekDay } from '@/lib/week';
import { radius, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = {
  days: WeekDay[];
  /** Day keys with at least one entry. */
  loggedDays: ReadonlySet<string>;
  /** Tapping today or an earlier day; later days can't be logged yet. */
  onPressDay: (dayKey: string) => void;
};

/** Figma "Week strip": this week, Sunday to Saturday. Today is an olive circle; a dot marks a day with entries. */
export function WeekStrip({ days, loggedDays, onPressDay }: Props) {
  const colors = useColors();
  const todayKey = days.find((day) => day.isToday)?.key ?? '';
  return (
    <View style={styles.row}>
      {days.map((day) => {
        const logged = loggedDays.has(day.key);
        const future = day.key > todayKey;
        return (
          <Pressable
            key={day.key}
            style={styles.day}
            accessibilityRole="button"
            accessibilityLabel={`${day.isToday ? 'Today, ' : ''}${day.name} ${day.date}${logged ? ', has entries' : ''}`}
            accessibilityHint={future ? undefined : 'Log symptoms for this day'}
            accessibilityState={{ disabled: future }}
            disabled={future}
            onPress={() => onPressDay(day.key)}>
            <AppText variant="caption" color="inkSoft">
              {day.letter}
            </AppText>
            <View style={[styles.date, day.isToday && { backgroundColor: colors.cta }]}>
              <AppText variant="label" style={day.isToday ? { color: colors.ctaInk } : undefined}>
                {day.date}
              </AppText>
            </View>
            <View style={[styles.dot, logged && { backgroundColor: colors.sage }]} />
          </Pressable>
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
