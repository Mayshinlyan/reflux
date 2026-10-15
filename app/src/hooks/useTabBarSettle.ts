import { useEffect, useRef } from 'react';
import {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const SOFT_SPRING = { damping: 12, stiffness: 180 };
const SWELL = 1.03;
const STRETCH = 1.35;
const SWELL_MS = 120;
const SWEEP_MS = 380;

type Geometry = {
  /** How far the highlight moves from the first tab to the second. */
  travel: number;
  pillWidth: number;
  sweepWidth: number;
};

/**
 * What the tab bar does when the tab changes: the whole pill swells a little and settles, one soft light sweep
 * crosses it in the direction of travel, and the highlight slides across, stretching in flight. With Reduce Motion
 * on, nothing moves: the highlight just jumps. Spread each style on an `Animated.View`.
 */
export function useTabBarSettle(index: 0 | 1, { travel, pillWidth, sweepWidth }: Geometry) {
  const reduceMotion = useReducedMotion();
  const previous = useRef(index);
  const slide = useSharedValue(index * travel);
  const stretch = useSharedValue(1);
  const swell = useSharedValue(1);
  const sweep = useSharedValue(0);
  const direction = useSharedValue(1);

  useEffect(() => {
    if (previous.current === index) return;
    direction.value = index > previous.current ? 1 : -1;
    previous.current = index;
    if (reduceMotion) {
      slide.value = index * travel;
      return;
    }
    slide.value = withSpring(index * travel, SOFT_SPRING);
    stretch.value = withSequence(withTiming(STRETCH, { duration: SWELL_MS }), withSpring(1, SOFT_SPRING));
    swell.value = withSequence(withTiming(SWELL, { duration: SWELL_MS }), withSpring(1, SOFT_SPRING));
    sweep.value = 0;
    sweep.value = withTiming(1, { duration: SWEEP_MS, easing: Easing.out(Easing.quad) });
  }, [index, reduceMotion, travel, slide, stretch, swell, sweep, direction]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ scale: swell.value }] }));
  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slide.value }, { scaleX: stretch.value }],
  }));
  const sweepStyle = useAnimatedStyle(() => {
    const from = direction.value > 0 ? -sweepWidth : pillWidth;
    const to = direction.value > 0 ? pillWidth : -sweepWidth;
    return {
      opacity: interpolate(sweep.value, [0, 0.2, 0.8, 1], [0, 1, 1, 0]),
      transform: [{ translateX: from + (to - from) * sweep.value }],
    };
  });

  return { pillStyle, highlightStyle, sweepStyle };
}
