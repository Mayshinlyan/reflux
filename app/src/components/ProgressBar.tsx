import { StyleSheet, View } from 'react-native';

import { radius, useColors } from '@/theme';

/** Figma "Progress bar": a thin tan track with an olive fill for how far through the setup they are. `step` is 1-based. */
export function ProgressBar({ step, total }: { step: number; total: number }) {
  const colors = useColors();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: step }}
      style={[styles.track, { backgroundColor: colors.surface2 }]}>
      <View style={[styles.fill, { width: `${(step / total) * 100}%`, backgroundColor: colors.cta }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.pill },
});
