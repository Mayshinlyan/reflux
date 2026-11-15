import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { slotLabel } from '@/constants/mealPlan';
import type { StoredMeal } from '@/db/repositories/mealPlans';
import { cardEdge, minTouchTarget, radius, space, useColors } from '@/theme';

type Props = {
  /** The weekday's name, e.g. "Monday". */
  dayName: string;
  /** Today's meals in the order they are eaten; skipped ones (eating out) are left out by the caller. */
  meals: readonly StoredMeal[];
  onOpen: (meal: StoredMeal) => void;
};

/**
 * "Today" on the Kitchen's this-week page (Figma "meal planning flow" F): today's planned meals, one row each, that
 * open as a recipe. With nothing planned today it says so, so the card never looks broken.
 */
export function TodayPlanCard({ dayName, meals, onOpen }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
      <View style={styles.head}>
        <AppText variant="section" accessibilityRole="header">
          Today
        </AppText>
        <AppText variant="caption" color="inkMuted">
          {dayName}
        </AppText>
      </View>
      {meals.length === 0 ? (
        <AppText color="inkSoft">Nothing planned today.</AppText>
      ) : (
        meals.map((meal, index) => (
          <View key={meal.id}>
            {index > 0 && <View style={[styles.divider, { backgroundColor: colors.edge }]} />}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${slotLabel(meal.slot)}, ${meal.dish.title}`}
              accessibilityHint="Opens the recipe"
              onPress={() => onOpen(meal)}
              style={styles.row}>
              <AppText variant="label" color="inkMuted" style={styles.slot}>
                {slotLabel(meal.slot)}
              </AppText>
              <AppText variant="bodyEm" numberOfLines={2} style={styles.title}>
                {meal.dish.title}
              </AppText>
              <ChevronRight size={20} color={colors.inkMuted} strokeWidth={2} />
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.s2, gap: space.s1 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s1_5, minHeight: minTouchTarget },
  slot: { width: 64 },
  title: { flex: 1 },
  divider: { height: 1 },
});
