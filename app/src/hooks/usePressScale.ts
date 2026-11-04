import { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

/** Grows about 5% under a finger, critically damped (no bounce), so it follows the finger down and settles back on release. */
export const PRESSED_SCALE = 1.05;
const SPRING = { duration: 220, dampingRatio: 1 } as const;

/**
 * The press feel of the app's buttons and the tab bar: the thing under the finger grows about 5% and eases back when it lifts. The spring
 * starts from wherever the scale is, so a quick second press never jumps. Spread `style` on an `Animated.View` around
 * the button's content and call `pressIn`/`pressOut` from its Pressable. With Reduce Motion on, nothing moves.
 */
export function usePressScale() {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const pressIn = () => {
    if (reduceMotion) return;
    scale.value = withSpring(PRESSED_SCALE, SPRING);
  };
  const pressOut = () => {
    scale.value = withSpring(1, SPRING);
  };

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return { style, pressIn, pressOut };
}
