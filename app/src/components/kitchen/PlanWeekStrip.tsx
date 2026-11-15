import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import type { PlanDay } from '@/lib/mealPlan';
import { cardEdge, minTouchTarget, radius, space, useColors } from '@/theme';

type Props = {
  days: readonly PlanDay[];
  /** The day whose meals are shown below; null when none is picked. */
  selected: string | null;
  /** Days that have a meal in the plan: a dot sits under them. Days without one are plain (nothing planned). */
  planned: ReadonlySet<string>;
  onSelect: (day: string) => void;
};

const CIRCLE = 40;

/**
 * The week of a plan, Monday first (Figma "meal planning flow" D and F): a letter, the date in a circle and a dot
 * when the day has a meal. The picked day is a filled olive circle. A day with nothing planned is plain text, but can
 * still be tapped (it just shows no meals).
 */
export function PlanWeekStrip({ days, selected, planned, onSelect }: Props) {
  const colors = useColors();
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {days.map((day) => {
        const isSelected = day.key === selected;
        const has = planned.has(day.key);
        return (
          <Pressable
            key={day.key}
            accessibilityRole="tab"
            accessibilityLabel={`${day.name} ${day.date}${has ? '' : ', nothing planned'}`}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(day.key)}
            style={styles.day}>
            <AppText variant="label" color="inkMuted">
              {day.letter}
            </AppText>
            <View
              style={[
                styles.circle,
                isSelected
                  ? { backgroundColor: colors.cta }
                  : has
                    ? { backgroundColor: colors.surface, ...cardEdge(colors) }
                    : null,
              ]}>
              <AppText
                variant="bodyEm"
                style={{ color: isSelected ? colors.ctaInk : has ? colors.ink : colors.inkMuted }}>
                {day.date}
              </AppText>
            </View>
            <View style={[styles.dot, has && { backgroundColor: colors.sageInk }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  day: { flex: 1, alignItems: 'center', gap: 4, minHeight: minTouchTarget },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 6, height: 6, borderRadius: radius.pill, marginBottom: space.s1 / 2 },
});
