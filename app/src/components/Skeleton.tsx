import { useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useColors } from '@/theme';

type Props = {
  width?: ViewStyle['width'];
  height: number;
  /** Corner radius; half the height makes a line, half the width a circle. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

const PULSE_MS = 900;

/**
 * Figma row 44: a soft `surface2` block that stands where a result is still on its way (a meal's name, verdict and
 * reasons while the check runs). It pulses gently, and holds still when Reduce Motion is on. It says nothing to a
 * screen reader: the page announces what is happening ("Checking…") in words.
 */
export function Skeleton({ width = '100%', height, radius = height / 2, style }: Props) {
  const colors = useColors();
  const still = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (still) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.55, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [pulse, still]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.surface2 }, animated, style]}
    />
  );
}
