import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { MealSection } from '@/components/stats/MealSection';
import { cardEdge, radius, space, useColors } from '@/theme';

import { StepLayout } from './StepLayout';

/** The made-up list in the picture: a food symptoms followed, and a food that sat well. */
const WATCH = [{ name: 'Spicy chicken tacos', times: 2, withSymptoms: 2 }];
const SAT = [{ name: 'Oatmeal with banana', times: 3, withSymptoms: 0 }];

/**
 * What you get for logging, in one screen (Figma 42a, was 17b): a picture of the weekly list, foods to watch and foods
 * that sat well. It is marked "Example", is not a control, and is the same list "Your week with Bellie" shows once
 * there is a week of meals behind it.
 */
export function HowItWorksStep({ onNext }: { onNext: () => void }) {
  const colors = useColors();
  return (
    <StepLayout
      title="Find what upsets your body."
      subtitle="Log for a week and Bellie makes your own list."
      footer={<Button label="Continue" onPress={onNext} />}>
      <View style={styles.stack}>
        <AppText variant="caption" color="inkSoft">
          Example
        </AppText>
        <View
          accessible
          accessibilityLabel="Example: Worth watching, Spicy chicken tacos, symptoms after 2 of 2 times. Sat well, Oatmeal with banana, 3 times, no symptoms after."
          pointerEvents="none"
          style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
          <MealSection
            label="Worth watching"
            state="some"
            rows={WATCH}
            count={(meal) => `${meal.withSymptoms} of ${meal.times}`}
            spoken={(meal) => meal.name}
          />
          <MealSection
            label="Sat well"
            state="calm"
            rows={SAT}
            count={(meal) => `${meal.times} times`}
            spoken={(meal) => meal.name}
          />
        </View>
      </View>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.s1_5 },
  card: { padding: space.s2 + 4, borderRadius: radius.lg, gap: space.s2 },
});
