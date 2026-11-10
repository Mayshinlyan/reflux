import { StyleSheet, View } from 'react-native';

import type { MealPattern } from '@/lib/statsCards';
import { space, useColors } from '@/theme';

import { AppText } from '../AppText';
import { DayAvatar } from './DayAvatar';

const AVATAR = 36;

type Props = {
  label: string;
  state: 'calm' | 'some';
  rows: MealPattern[];
  count: (meal: MealPattern) => string;
  spoken: (meal: MealPattern) => string;
};

/** A small label over rows of foods, each with a round avatar and a count (Figma 28b, 42b). Shared by History and the report. */
export function MealSection({ label, state, rows, count, spoken }: Props) {
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
});
