import { CookingPot } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { radius, useColors } from '@/theme';

const STEAM_DELAYS = [0, 400, 800];

/** A wisp of steam that rises and fades, looping. */
function Steam({ delay, color, still }: { delay: number; color: string; still: boolean }) {
  const rise = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    rise.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1, false),
    );
  }, [delay, rise, still]);
  const style = useAnimatedStyle(() => ({
    opacity: still ? 0.5 : 0.7 * (1 - rise.value),
    transform: [{ translateY: -rise.value * 16 }],
  }));
  return <Animated.View style={[styles.steam, { backgroundColor: color }, style]} />;
}

/**
 * The steaming pot (Figma 29c, "the existing steaming-pot loader"): a pot that bobs and steams in a pulsing circle.
 * Motion stops (the pot stays) when reduced motion is on. Used by every wait that has the relay working: a meal check,
 * recipe ideas, the week plan.
 */
export function PotLoader() {
  const colors = useColors();
  const still = useReducedMotion();
  const pulse = useSharedValue(0);
  const wobble = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
    wobble.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 700, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [pulse, wobble, still]);

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.07 }] }));
  const potStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wobble.value * 5}deg` }] }));

  return (
    <View style={styles.stage}>
      <View style={styles.steamRow}>
        {STEAM_DELAYS.map((delay) => (
          <Steam key={delay} delay={delay} color={colors.sage} still={still} />
        ))}
      </View>
      <Animated.View style={[styles.circle, { backgroundColor: colors.sageTint }, circleStyle]}>
        <Animated.View style={potStyle}>
          <CookingPot size={38} color={colors.sageInk} strokeWidth={2} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center' },
  steamRow: { flexDirection: 'row', gap: 10, height: 20, marginBottom: 4 },
  steam: { width: 5, height: 14, borderRadius: radius.pill },
  circle: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
