import { StyleSheet, View } from 'react-native';

import type { MealPattern } from '@/lib/statsCards';
import { space } from '@/theme';

import { AppText } from '../AppText';
import { Belly } from '../Belly';
import { MealSection } from './MealSection';
import { StatCard, StatHeader } from './StatCard';

type Props = {
  patterns: { sat: MealPattern[]; watch: MealPattern[] };
  width: number;
  height: number;
};

/**
 * Figma row 28b and 28f: meals eaten more than once, split by whether symptoms were logged after them. What
 * it says is what was noticed, never what caused it, and a meal needs two or more times before it shows.
 */
export function MealsCard({ patterns, width, height }: Props) {
  const empty = patterns.sat.length === 0 && patterns.watch.length === 0;
  if (empty) {
    return (
      <StatCard width={width} height={height} gap={space.s2}>
        <StatHeader title="What sat well" />
        <View style={styles.empty}>
          <Belly mood="happy" size={96} />
          <AppText variant="voiceSmall" style={styles.centered}>
            Log symptoms after meals and Bellie will start spotting patterns.
          </AppText>
        </View>
      </StatCard>
    );
  }
  return (
    <StatCard width={width} height={height} gap={space.s2}>
      <StatHeader title="What sat well" />
      {patterns.sat.length > 0 && (
        <MealSection
          label="Sat well"
          state="calm"
          rows={patterns.sat}
          count={(meal) => `${meal.times} times`}
          spoken={(meal) => `${meal.name}, eaten ${meal.times} times, no symptoms after`}
        />
      )}
      {patterns.watch.length > 0 && (
        <MealSection
          label="Worth watching"
          state="some"
          rows={patterns.watch}
          count={(meal) => `${meal.withSymptoms} of ${meal.times}`}
          spoken={(meal) => `${meal.name}, symptoms after ${meal.withSymptoms} of ${meal.times} times`}
        />
      )}
    </StatCard>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', gap: space.s1_5, paddingVertical: space.s3 },
  centered: { textAlign: 'center' },
});
