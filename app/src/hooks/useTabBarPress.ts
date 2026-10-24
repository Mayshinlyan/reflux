import { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

/** A small shrink, critically damped (no bounce), so it follows the finger down and settles back on release. */
const PRESSED_SCALE = 0.92;
const SPRING = { duration: 220, dampingRatio: 1 } as const;

/**
 * The tab bar's press feel: the button under the finger shrinks a little and eases back when it lifts. The spring
 * starts from wherever the scale is, so a quick second press never jumps. Spread `style` on an `Animated.View` around
 * the button's content and call `pressIn`/`pressOut` from its Pressable. With Reduce Motion on, nothing moves.
 */
export function useTabBarPress() {
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
