import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { space, useColors } from '@/theme';

const BARS = 25;
const BAR_WIDTH = 6;
const GAP = 5;
const MAX_HEIGHT = 124;
const MIN_HEIGHT = 6;
/** How far each bar sways over a loop, as a share of its height; the rest follows the voice. */
const SWAY = 0.35;
const LOOP_MS = 1200;

/** Each bar's tallest height: a bell, so the middle bars rise most and the ends least (Figma 45b). */
const PEAKS = Array.from(
  { length: BARS },
  (_, index) => MAX_HEIGHT * (0.25 + 0.75 * Math.sin((Math.PI * (index + 0.5)) / BARS)),
);

type BarProps = { index: number; level: SharedValue<number>; phase: SharedValue<number>; still: boolean };

function Bar({ index, level, phase, still }: BarProps) {
  const colors = useColors();
  const peak = PEAKS[index] ?? MAX_HEIGHT;
  const style = useAnimatedStyle(() => {
    // Reduce Motion: one fixed wave, the shape of the Figma frame.
    if (still) return { height: MIN_HEIGHT + (peak - MIN_HEIGHT) * 0.6 };
    // Each bar sways a little out of step with its neighbours, so the wave ripples; how tall it gets is the voice.
    const sway = 1 - SWAY + SWAY * Math.sin(phase.value * 2 * Math.PI + index * 0.7);
    return { height: MIN_HEIGHT + (peak - MIN_HEIGHT) * level.value * sway };
  });
  return <Animated.View style={[styles.bar, { backgroundColor: colors.cta }, style]} />;
}

type Props = {
  /** How loud the voice is, 0 to 1, already smoothed. Silence settles the wave to a nearly flat line. */
  level: SharedValue<number>;
  /** Tapping the wave ends the recording, like Done. */
  onPress: () => void;
};

/**
 * Figma 45b: 25 rounded bars that rise and fall with your voice while Bellie listens, like Wispr Flow. No words
 * show while you talk; they appear after Done. Under Reduce Motion it is one still wave.
 */
export function VoiceWave({ level, onPress }: Props) {
  const still = useReducedMotion();
  const phase = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    phase.value = withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1, false);
  }, [phase, still]);
  return (
    // For a finger only: a screen reader already has Done, so it skips the wave rather than hear two stop buttons.
    <Pressable
      testID="voice-wave"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      onPress={onPress}
      style={styles.wave}>
      {PEAKS.map((_, index) => (
        <Bar key={index} index={index} level={level} phase={phase} still={still} />
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wave: {
    height: MAX_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    // At least a finger wide and tall, wherever the bars happen to be.
    paddingHorizontal: space.s2,
  },
  bar: { width: BAR_WIDTH, borderRadius: BAR_WIDTH / 2 },
});
