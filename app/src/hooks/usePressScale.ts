import { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

/** The tab bar (and the Log button) grow about 3% under a finger; buttons shrink about 3%. */
export const PRESS_GROW = 1.03;
export const PRESS_SHRINK = 0.97;
/** Critically damped (no bounce), so it follows the finger down and settles back on release. */
const SPRING = { duration: 220, dampingRatio: 1 } as const;

/**
 * The press feel of the app's buttons and the tab bar: the thing under the finger moves to `pressedScale`
 * (`PRESS_SHRINK` for buttons, `PRESS_GROW` for the tab bar) and eases back when it lifts. The spring starts from
 * wherever the scale is, so a quick second press never jumps. Spread `style` on an `Animated.View` around the
 * button's content and call `pressIn`/`pressOut` from its Pressable. With Reduce Motion on, nothing moves.
 */
export function usePressScale(pressedScale: number = PRESS_GROW) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const pressIn = () => {
    if (reduceMotion) return;
    scale.value = withSpring(pressedScale, SPRING);
  };
  const pressOut = () => {
    scale.value = withSpring(1, SPRING);
  };

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return { style, pressIn, pressOut };
}
