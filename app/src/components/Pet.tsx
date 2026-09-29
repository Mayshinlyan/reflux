import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Heart } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, type GestureResponderEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { lineForTap, nextReaction, TAP_COOLDOWN_MS, tiltFromTouch } from '@/lib/petMotion';
import { radius, space, typography, useColors } from '@/theme';

const DOG_IMAGE = require('@/assets/images/pet/dog.png');
/** dog.png is 276×298; keep its aspect ratio. */
const ASPECT = 298 / 276;

const SOFT_SPRING = { damping: 9, stiffness: 180, mass: 0.8 };

type Props = { name: string; width: number };

/**
 * The companion pet. A flat illustration given depth with perspective transforms:
 * it breathes when idle, tilts toward your finger, and plays a hop, a 3D spin or a
 * wiggle on each tap, with a ground shadow, a floating heart and a speech bubble.
 * Taps are play only and never affect progress. Reduced motion keeps only the
 * bubble and haptic.
 */
export function Pet({ name, width }: Props) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  const height = Math.round(width * ASPECT);

  const breathe = useSharedValue(0);
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const spin = useSharedValue(0);
  const hop = useSharedValue(0);
  const squashX = useSharedValue(1);
  const squashY = useSharedValue(1);
  const wiggle = useSharedValue(0);
  const heart = useSharedValue(0);

  const tapCount = useRef(0);
  const lastTap = useRef(0);
  const [bubble, setBubble] = useState<string | null>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reduceMotion) return;
    breathe.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [breathe, reduceMotion]);

  useEffect(
    () => () => {
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    },
    [],
  );

  const onPressIn = (event: GestureResponderEvent) => {
    if (reduceMotion) return;
    const { locationX, locationY } = event.nativeEvent;
    const tilt = tiltFromTouch(locationX, locationY, width, height);
    tiltX.value = withSpring(tilt.rotateX, SOFT_SPRING);
    tiltY.value = withSpring(tilt.rotateY, SOFT_SPRING);
    squashX.value = withSpring(1.06, SOFT_SPRING);
    squashY.value = withSpring(0.94, SOFT_SPRING);
  };

  const onPressOut = () => {
    tiltX.value = withSpring(0, SOFT_SPRING);
    tiltY.value = withSpring(0, SOFT_SPRING);
    squashX.value = withSpring(1, SOFT_SPRING);
    squashY.value = withSpring(1, SOFT_SPRING);
  };

  const onPress = () => {
    const now = Date.now();
    if (now - lastTap.current < TAP_COOLDOWN_MS) return;
    lastTap.current = now;
    const count = tapCount.current++;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const line = lineForTap(count);
    setBubble(line);
    AccessibilityInfo.announceForAccessibility(`${name}: ${line}`);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), 1600);

    if (reduceMotion) return;
    heart.value = 0;
    heart.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) });

    const reaction = nextReaction(count);
    if (reaction === 'hop' || reaction === 'spin') {
      // Anticipation squash, stretch on the way up, squash again on landing.
      hop.value = withSequence(
        withTiming(-46, { duration: 260, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 240, easing: Easing.in(Easing.quad) }),
      );
      squashY.value = withSequence(
        withTiming(1.08, { duration: 200 }),
        withTiming(1, { duration: 260 }),
        withTiming(0.9, { duration: 90 }),
        withSpring(1, SOFT_SPRING),
      );
      squashX.value = withSequence(
        withTiming(0.94, { duration: 200 }),
        withTiming(1, { duration: 260 }),
        withTiming(1.1, { duration: 90 }),
        withSpring(1, SOFT_SPRING),
      );
    }
    if (reaction === 'spin') {
      spin.value = 0;
      spin.value = withTiming(360, { duration: 520, easing: Easing.inOut(Easing.cubic) });
    }
    if (reaction === 'wiggle') {
      wiggle.value = withSequence(
        withTiming(-9, { duration: 70 }),
        withTiming(9, { duration: 110 }),
        withTiming(-7, { duration: 110 }),
        withTiming(5, { duration: 100 }),
        withSpring(0, SOFT_SPRING),
      );
    }
  };

  const petStyle = useAnimatedStyle(() => {
    const breath = breathe.value;
    return {
      transform: [
        { perspective: 700 },
        { translateY: hop.value - breath * 3 },
        { rotateX: `${tiltX.value}deg` },
        { rotateY: `${tiltY.value + spin.value}deg` },
        { rotateZ: `${wiggle.value}deg` },
        { scaleX: squashX.value * (1 + breath * 0.012) },
        { scaleY: squashY.value * (1 + breath * 0.022) },
      ],
    };
  });

  // The shadow stays on the ground: it shrinks and fades as the pet rises.
  const shadowStyle = useAnimatedStyle(() => {
    const lift = Math.min(1, -hop.value / 46);
    return {
      opacity: 0.16 * (1 - lift * 0.6),
      transform: [{ scaleX: (1 - lift * 0.35) * (1 + breathe.value * 0.03) }],
    };
  });

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heart.value === 0 ? 0 : 1 - heart.value,
    transform: [{ translateY: -heart.value * 70 }, { scale: 0.6 + heart.value * 0.6 }],
  }));

  return (
    <View style={[styles.wrap, { width, height: height + space.s2 }]}>
      <Animated.View
        style={[styles.shadow, { width: width * 0.62, backgroundColor: colors.ink }, shadowStyle]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Pet ${name}`}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}>
        <Animated.View style={petStyle}>
          <Image source={DOG_IMAGE} style={{ width, height }} contentFit="contain" accessible={false} />
        </Animated.View>
      </Pressable>

      <Animated.View pointerEvents="none" style={[styles.heart, heartStyle]}>
        <Heart size={28} color={colors.clay} fill={colors.clay} />
      </Animated.View>

      {bubble && (
        <View
          pointerEvents="none"
          style={[styles.bubble, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
          <Animated.Text style={[styles.bubbleText, { color: colors.ink }]}>{bubble}</Animated.Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-end' },
  shadow: { position: 'absolute', bottom: 2, height: 16, borderRadius: radius.pill },
  heart: { position: 'absolute', top: space.s3, right: space.s3 },
  bubble: {
    position: 'absolute',
    top: -space.s4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: space.s1,
    paddingHorizontal: space.s2,
  },
  bubbleText: { ...typography.label, fontSize: 14 },
});
