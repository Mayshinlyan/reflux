import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { slotLabel } from '@/constants/mealPlan';
import type { StoredMeal } from '@/db/repositories/mealPlans';
import { cardEdge, radius, space, useColors } from '@/theme';

type Props = {
  meal: StoredMeal;
  /** "Log it": opens the food log with this dish typed in. Nothing is logged until they save it there. */
  onLog: () => void;
  /** "Not today": the meal leaves the plan for today. */
  onNotToday: () => void;
};

/**
 * Today's next planned meal (Figma "meal planning flow" G2): its meal name, the dish, a line on why it fits, and two
 * ways to answer. It only asks; a plan is never logged on its own.
 */
export function PlannedMealCard({ meal, onLog, onNotToday }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
      <View style={styles.top}>
        <AppText variant="caption" color="inkSoft">
          {slotLabel(meal.slot)}
        </AppText>
        <View style={[styles.pill, { backgroundColor: colors.sageTint }]}>
          <AppText variant="caption" style={{ color: colors.sageInk }}>
            From your plan
          </AppText>
        </View>
      </View>
      <View style={styles.text}>
        <AppText variant="displaySmall" accessibilityRole="header" numberOfLines={2}>
          {meal.dish.title}
        </AppText>
        {meal.dish.why ? (
          <AppText color="inkSoft" numberOfLines={2}>
            {meal.dish.why}
          </AppText>
        ) : null}
      </View>
      <View style={styles.buttons}>
        <View style={styles.fill}>
          <Button label="Log it" onPress={onLog} />
        </View>
        <View style={styles.fill}>
          <Button label="Not today" variant="secondary" onPress={onNotToday} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.s2, gap: space.s1_5 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { borderRadius: radius.pill, paddingHorizontal: space.s1_5, paddingVertical: 4 },
  text: { gap: space.s1 },
  buttons: { flexDirection: 'row', gap: space.s1_5, marginTop: space.s1 },
  fill: { flex: 1 },
});
