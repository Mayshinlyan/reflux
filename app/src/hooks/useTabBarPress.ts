import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/** Very subtle: about 2% bigger (5 px wider), and eased in and out with no overshoot, so it never bounces. */
const PRESSED_SCALE = 1.02;
const PRESS_MS = 100;
const RELEASE_MS = 180;

/**
 * The tab bar's press feel: the whole pill grows a hair while a finger is down on a tab and eases back on release,
 * like Instagram's tab bar. Spread `pillStyle` on an `Animated.View` around the pill and call `pressIn`/`pressOut`
 * from the tabs. With Reduce Motion on, nothing moves.
 */
export function useTabBarPress() {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const pressIn = () => {
    if (reduceMotion) return;
    scale.value = withTiming(PRESSED_SCALE, { duration: PRESS_MS, easing: Easing.out(Easing.quad) });
  };
  const pressOut = () => {
    scale.value = withTiming(1, { duration: RELEASE_MS, easing: Easing.out(Easing.quad) });
  };

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return { pillStyle, pressIn, pressOut };
}
