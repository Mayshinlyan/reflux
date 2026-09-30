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
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CLIP_MS, PET_ASPECT, type PetClip, type PetPoster, viewFor } from '@/lib/petClips';
import type { PetMood } from '@/lib/petProgress';
import { lineForTap, TAP_COOLDOWN_MS, tiltFromTouch } from '@/lib/petMotion';
import { radius, space, typography, useColors } from '@/theme';

const CLIPS: Record<PetClip, number> = {
  react_happy: require('@/assets/images/pet/react_happy.webp'),
  react_unwell: require('@/assets/images/pet/react_unwell.webp'),
  celebrate: require('@/assets/images/pet/celebrate.webp'),
};
const POSTERS: Record<PetPoster, number> = {
  poster_happy: require('@/assets/images/pet/poster_happy.webp'),
  poster_unwell: require('@/assets/images/pet/poster_unwell.webp'),
};

/** Extra time a clip may take to load before the pet returns to its still anyway. */
const LOAD_MARGIN_MS = 1500;

const SOFT_SPRING = { damping: 9, stiffness: 180, mass: 0.8 };

type Props = {
  name: string;
  width: number;
  mood: PetMood;
  /** Play the one-time stage-up celebration, then call `onCelebrationEnd`. */
  celebrating: boolean;
  onCelebrationEnd: () => void;
};

/**
 * The companion pet: a pre-rendered 3D dog. At rest it is a still image matching its
 * mood, breathing gently. A tap plays its mood clip once (with a haptic, a heart and a
 * speech bubble), and a stage-up plays the celebration clip once; then it returns to
 * the still. Taps are play only and never affect progress. Nothing plays when Today
 * isn't focused or the app is backgrounded, and reduced motion keeps only the bubble
 * and haptic.
 */
export function Pet({ name, width, mood, celebrating, onCelebrationEnd }: Props) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  const height = Math.round(width * PET_ASPECT);

  const [focused, setFocused] = useState(true);
  const [reacting, setReacting] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        // A tap reaction cut short by leaving Today is dropped, not replayed on return.
        setReacting(false);
      };
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
      if (state !== 'active') setReacting(false);
    });
    return () => subscription.remove();
  }, []);
  const active = focused && appActive;

  const view = viewFor({ mood, celebrating, reacting, active, reduceMotion });
  const playing = view.kind === 'clip' ? view.clip : null;

  // Each clip plays once, then the pet goes back to its still. The timer runs from when the
  // clip has loaded (a first play takes a moment to decode), with a margin in case the
  // load event never comes, and only while the clip is on screen, so leaving Today
  // mid-celebration doesn't use it up unwatched.
  const [loaded, setLoaded] = useState<string | null>(null);
  const shown = view.kind === 'clip' ? view.clip : view.poster;
  useEffect(() => {
    if (!playing) return;
    const ms = loaded === playing ? CLIP_MS[playing] : CLIP_MS[playing] + LOAD_MARGIN_MS;
    const timer = setTimeout(() => {
      setLoaded(null);
      if (playing === 'celebrate') onCelebrationEnd();
      else setReacting(false);
    }, ms);
    return () => clearTimeout(timer);
  }, [playing, loaded, onCelebrationEnd]);

  // With reduced motion there is no celebration to watch, so the stage is marked seen.
  useEffect(() => {
    if (celebrating && reduceMotion) onCelebrationEnd();
  }, [celebrating, reduceMotion, onCelebrationEnd]);

  // A gentle breath keeps the still pet alive; it stops while a clip plays.
  const breathe = useSharedValue(0);
  const still = view.kind === 'still' && active && !reduceMotion;
  useEffect(() => {
    if (still) {
      breathe.value = withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(breathe);
      breathe.value = withTiming(0, { duration: 200 });
    }
  }, [breathe, still]);

  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const squashX = useSharedValue(1);
  const squashY = useSharedValue(1);
  const heart = useSharedValue(0);

  const tapCount = useRef(0);
  const lastTap = useRef(0);
  const [bubble, setBubble] = useState<string | null>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    squashX.value = withSpring(1.04, SOFT_SPRING);
    squashY.value = withSpring(0.96, SOFT_SPRING);
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
    // A clip already playing runs to its end rather than restarting on every tap, and a
    // tap during the celebration doesn't queue a reaction for afterwards.
    if (!celebrating) setReacting(true);
  };

  const petStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 700 },
      { translateY: -breathe.value * 3 },
      { rotateX: `${tiltX.value}deg` },
      { rotateY: `${tiltY.value}deg` },
      { scaleX: squashX.value * (1 + breathe.value * 0.012) },
      { scaleY: squashY.value * (1 + breathe.value * 0.022) },
    ],
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 + breathe.value * 0.03 }],
  }));

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heart.value === 0 ? 0 : 1 - heart.value,
    transform: [{ translateY: -heart.value * 70 }, { scale: 0.6 + heart.value * 0.6 }],
  }));

  return (
    <View style={[styles.wrap, { width, height: height + space.s2 }]}>
      <Animated.View
        style={[styles.shadow, { width: width * 0.55, backgroundColor: colors.ink }, shadowStyle]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Pet ${name}`}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}>
        <Animated.View style={petStyle}>
          {/* One image view whose source changes: expo-image keeps showing the current
              picture until the next one is ready, so switching never flashes blank. */}
          <Image
            source={view.kind === 'clip' ? CLIPS[view.clip] : POSTERS[view.poster]}
            style={{ width, height }}
            contentFit="contain"
            // Apple's default WebP codec can blend or time animated frames wrongly.
            useAppleWebpCodec={false}
            onLoad={() => setLoaded(shown)}
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
  shadow: { position: 'absolute', bottom: 2, height: 16, borderRadius: radius.pill, opacity: 0.16 },
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
