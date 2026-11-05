import { StyleSheet, View } from 'react-native';

import type { MealPattern } from '@/lib/statsCards';
import { space, useColors } from '@/theme';

import { AppText } from '../AppText';
import { Belly } from '../Belly';
import { DayAvatar } from './DayAvatar';
import { StatCard, StatHeader } from './StatCard';

const AVATAR = 36;

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
        <Section
          label="Sat well"
          state="calm"
          rows={patterns.sat}
          count={(meal) => `${meal.times} times`}
          spoken={(meal) => `${meal.name}, eaten ${meal.times} times, no symptoms after`}
        />
      )}
      {patterns.watch.length > 0 && (
        <Section
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

function Section({
  label,
  state,
  rows,
  count,
  spoken,
}: {
  label: string;
  state: 'calm' | 'some';
  rows: MealPattern[];
  count: (meal: MealPattern) => string;
  spoken: (meal: MealPattern) => string;
}) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <AppText variant="label" color="inkSoft" accessibilityRole="header">
        {label}
      </AppText>
      <View>
        {rows.map((meal, index) => (
          <View
            key={meal.name}
            accessible
            accessibilityLabel={spoken(meal)}
            style={[
              styles.row,
              index < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.hairline },
            ]}>
            <DayAvatar state={state} size={AVATAR} />
            <AppText numberOfLines={2} style={styles.name}>
              {meal.name}
            </AppText>
            <AppText variant="caption" color="inkSoft">
              {count(meal)}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s1_5, paddingVertical: 6 },
  name: { flex: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: space.s1_5, paddingVertical: space.s3 },
  centered: { textAlign: 'center' },
});
