import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { slotLabel } from '@/constants/mealPlan';
import type { StoredMeal } from '@/db/repositories/mealPlans';
import { cardEdge, minTouchTarget, radius, space, useColors } from '@/theme';

type Props = {
  /** "Today", or the weekday's name ("Tuesday") when another day of the week strip is picked. */
  title: string;
  /** The picked day is today: only the empty line reads differently. */
  isToday: boolean;
  /** The picked day's meals in the order they are eaten; skipped ones (eating out) are left out by the caller. */
  meals: readonly StoredMeal[];
  onOpen: (meal: StoredMeal) => void;
  /** "Edit plan": opens the review page, where meals are swapped or skipped. */
  onEdit: () => void;
};

/**
 * The menu of the picked day on the Kitchen's this-week page (Figma "meal planning flow" F2): "Today" and today's
 * meals to begin with, another day's name and meals when that day of the week strip is tapped. Each meal opens as a
 * recipe, and "Edit plan" opens the review page. With nothing planned it says so, so the card never looks broken.
 */
export function TodayPlanCard({ title, isToday, meals, onOpen, onEdit }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
      <View style={styles.head}>
        <AppText variant="section" accessibilityRole="header">
          {title}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit plan"
          accessibilityHint="Opens the meal plan to swap or skip meals"
          onPress={onEdit}
          hitSlop={12}
          style={styles.edit}>
          <AppText variant="caption" color="inkMuted" style={styles.underline}>
            Edit plan
          </AppText>
        </Pressable>
      </View>
      {meals.length === 0 ? (
        <AppText color="inkSoft">
          {isToday ? 'Nothing planned today.' : `Nothing planned for ${title}.`}
        </AppText>
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
  edit: { minHeight: 28, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s1_5, minHeight: minTouchTarget },
  slot: { width: 64 },
  title: { flex: 1 },
  divider: { height: 1 },
});
