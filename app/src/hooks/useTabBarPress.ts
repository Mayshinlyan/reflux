import { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

const PRESSED_SCALE = 1.04;
const PRESS_SPRING = { damping: 15, stiffness: 300 };
const RELEASE_SPRING = { damping: 12, stiffness: 180 };

/**
 * The tab bar's press feel: the whole pill grows a little while a finger is down on a tab and springs back on
 * release, like a physical button. Spread `pillStyle` on an `Animated.View` around the pill and call
 * `pressIn`/`pressOut` from the tabs. With Reduce Motion on, nothing moves.
 */
export function useTabBarPress() {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const pressIn = () => {
    if (reduceMotion) return;
    scale.value = withSpring(PRESSED_SCALE, PRESS_SPRING);
  };
  const pressOut = () => {
    scale.value = withSpring(1, RELEASE_SPRING);
  };

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return { pillStyle, pressIn, pressOut };
}
