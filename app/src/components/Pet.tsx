import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  type GestureResponderEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CELEBRATE_MS, clipFor, PET_ASPECT, type PetClip, posterFor } from '@/lib/petClips';
import type { PetMood } from '@/lib/petProgress';
import { lineForTap, nextReaction, TAP_COOLDOWN_MS, tiltFromTouch } from '@/lib/petMotion';
import { radius, space, typography, useColors } from '@/theme';

const CLIPS: Record<PetClip, number> = {
  idle_happy: require('@/assets/images/pet/idle_happy.webp'),
  idle_unwell: require('@/assets/images/pet/idle_unwell.webp'),
  idle_neutral: require('@/assets/images/pet/idle_neutral.webp'),
  celebrate: require('@/assets/images/pet/celebrate.webp'),
};
const POSTERS = {
  poster_happy: require('@/assets/images/pet/poster_happy.png'),
  poster_unwell: require('@/assets/images/pet/poster_unwell.png'),
};

const SOFT_SPRING = { damping: 9, stiffness: 180, mass: 0.8 };

type Props = {
  name: string;
  width: number;
  mood: PetMood;
  /** False until the first entry is logged. */
  hasLogs: boolean;
  /** Play the one-time stage-up celebration, then call `onCelebrationEnd`. */
  celebrating: boolean;
  onCelebrationEnd: () => void;
};

/**
 * The companion pet: a pre-rendered 3D dog. A looping clip matches its mood (a calm
 * one before the first entry), and a one-time celebration clip plays on a stage-up.
 * On top of that it tilts toward your finger and plays a hop, a spin or a wiggle on
 * each tap, with a ground shadow, a floating heart and a speech bubble. Taps are play
 * only and never affect progress. Reduced motion shows a still and keeps only the
 * bubble and haptic. Clips pause when Today isn't focused or the app is backgrounded.
 */
export function Pet({ name, width, mood, hasLogs, celebrating, onCelebrationEnd }: Props) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  const height = Math.round(width * PET_ASPECT);

  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const spin = useSharedValue(0);
  const hop = useSharedValue(0);
  const squashX = useSharedValue(1);
  const squashY = useSharedValue(1);
  const wiggle = useSharedValue(0);
  const heart = useSharedValue(0);

  const playCelebration = celebrating && !reduceMotion;
  const clip = clipFor({ mood, hasLogs, celebrating: playCelebration });

  const tapCount = useRef(0);
  const lastTap = useRef(0);
  const [bubble, setBubble] = useState<string | null>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clips only play while Today is on screen and the app is in the foreground.
  const imageRef = useRef<Image>(null);
  const [focused, setFocused] = useState(true);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  const playing = focused && appActive && !reduceMotion;
  useEffect(() => {
    if (playing) imageRef.current?.startAnimating().catch(() => {});
    else imageRef.current?.stopAnimating().catch(() => {});
  }, [playing]);

  // The celebration plays once, then hands back so the stage is marked as seen. The timer
  // only runs while the clip is actually playing, so leaving Today mid-celebration doesn't
  // use it up unwatched. With reduced motion there is nothing to play, so it is marked seen
  // straight away.
  useEffect(() => {
    if (!celebrating) return;
    if (reduceMotion) {
      onCelebrationEnd();
      return;
    }
    if (!playing) return;
    const timer = setTimeout(onCelebrationEnd, CELEBRATE_MS);
    return () => clearTimeout(timer);
  }, [celebrating, reduceMotion, playing, onCelebrationEnd]);

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
    return {
      transform: [
        { perspective: 700 },
        { translateY: hop.value },
        { rotateX: `${tiltX.value}deg` },
        { rotateY: `${tiltY.value + spin.value}deg` },
        { rotateZ: `${wiggle.value}deg` },
        { scaleX: squashX.value },
        { scaleY: squashY.value },
      ],
    };
  });

  // The shadow stays on the ground: it shrinks and fades as the pet rises.
  const shadowStyle = useAnimatedStyle(() => {
    const lift = Math.min(1, -hop.value / 46);
    return {
      opacity: 0.16 * (1 - lift * 0.6),
      transform: [{ scaleX: 1 - lift * 0.35 }],
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
          <Image
            // A new clip is a new view, so it starts from its first frame.
            key={reduceMotion ? 'poster' : clip}
            ref={imageRef}
            source={reduceMotion ? POSTERS[posterFor(mood)] : CLIPS[clip]}
            style={{ width, height }}
            contentFit="contain"
            autoplay={playing}
            // Apple's default WebP codec can blend or time animated frames wrongly.
            useAppleWebpCodec={false}
            accessible={false}
          />
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
