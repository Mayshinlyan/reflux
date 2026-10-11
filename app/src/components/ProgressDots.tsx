import { StyleSheet, View } from 'react-native';

import { useColors } from '@/theme';

/** Figma "Progress dots": the current step is a 24pt olive pill, the others 8pt dots. `step` is 1-based. */
export function ProgressDots({ step, total }: { step: number; total: number }) {
  const colors = useColors();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: step }}
      style={styles.row}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i + 1 === step
              ? { width: 24, backgroundColor: colors.cta }
              : { width: 8, backgroundColor: colors.hairline },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4 },
});
