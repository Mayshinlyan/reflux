import { type GestureResponderEvent } from 'react-native';
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { tiltFromTouch } from '@/lib/bellyMotion';

const SOFT_SPRING = { damping: 12, stiffness: 180 };

/**
 * The belly's squash, 3D tilt, hop and wobble. Spread `style` on an `Animated.View` around the belly,
 * call `pressIn`/`pressOut` from the surrounding Pressable and `play()` on a tap. With Reduce Motion on,
 * `reduceMotion` is true and nothing moves.
 */
export function useBellyJiggle(touchWidth: number, touchHeight: number) {
  const reduceMotion = useReducedMotion();
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const squashX = useSharedValue(1);
  const squashY = useSharedValue(1);
  const hop = useSharedValue(0);
  const wobble = useSharedValue(0);

  const pressIn = (event: GestureResponderEvent) => {
    if (reduceMotion) return;
    const { locationX, locationY } = event.nativeEvent;
    const tilt = tiltFromTouch(locationX, locationY, touchWidth, touchHeight);
    tiltX.value = withSpring(tilt.rotateX, SOFT_SPRING);
    tiltY.value = withSpring(tilt.rotateY, SOFT_SPRING);
    squashX.value = withSpring(1.06, SOFT_SPRING);
    squashY.value = withSpring(0.94, SOFT_SPRING);
  };

  const pressOut = () => {
    tiltX.value = withSpring(0, SOFT_SPRING);
    tiltY.value = withSpring(0, SOFT_SPRING);
    squashX.value = withSpring(1, SOFT_SPRING);
    squashY.value = withSpring(1, SOFT_SPRING);
  };

  const play = () => {
    if (reduceMotion) return;
    hop.value = withSequence(withTiming(-14, { duration: 120 }), withSpring(0, SOFT_SPRING));
    wobble.value = withSequence(
      withTiming(-6, { duration: 70 }),
      withTiming(6, { duration: 100 }),
      withTiming(-4, { duration: 90 }),
      withTiming(3, { duration: 70 }),
      withTiming(0, { duration: 60 }),
    );
  };

  const style = useAnimatedStyle(() => ({
    transform: [
      { perspective: 700 },
      { translateY: hop.value },
      { rotateX: `${tiltX.value}deg` },
      { rotateY: `${tiltY.value}deg` },
      { rotateZ: `${wobble.value}deg` },
      { scaleX: squashX.value },
      { scaleY: squashY.value },
    ],
  }));

  return { style, reduceMotion, pressIn, pressOut, play };
}
