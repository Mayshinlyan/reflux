import { StyleSheet, View } from 'react-native';

import { radius, space, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = {
  /** 1-based current step. */
  step: number;
  total: number;
  /** Short name of the current step, shown under the line. */
  caption: string;
  label?: string;
};

/**
 * A line split into one segment per step: finished steps are filled sage, the current
 * step terracotta, later steps empty. Announced as a progress bar ("Step 2 of 3").
 */
export function StepTracker({ step, total, caption, label = 'Progress' }: Props) {
  const colors = useColors();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 1, max: total, now: step, text: `Step ${step} of ${total}, ${caption}` }}
      style={styles.wrap}>
      <View style={styles.segments}>
        {Array.from({ length: total }, (_, index) => {
          const number = index + 1;
          const backgroundColor =
            number < step ? colors.sage : number === step ? colors.cta : colors.surface2;
          return (
            <View
              key={number}
              testID={`step-segment-${number}`}
              style={[styles.segment, { backgroundColor }]}
            />
          );
        })}
      </View>
      <AppText variant="caption" color="inkSoft" style={styles.caption}>
        {`Step ${step} of ${total} · ${caption}`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.s2 },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 6, borderRadius: radius.pill },
  caption: { textAlign: 'center', marginTop: space.s1, fontFamily: 'Nunito_700Bold' },
});
