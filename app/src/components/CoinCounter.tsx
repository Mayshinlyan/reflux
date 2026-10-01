import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { logger } from '@/lib/logger';
import { radius, useColors } from '@/theme';

const CHING = require('@/assets/sounds/coin.wav');

/** Waits for the log screen's closing transition, so the pop lands on a settled Today. */
const CELEBRATE_DELAY_MS = 350;

type Props = {
  coins: number;
  /** Coins just earned; with a new `gainId` the counter chings and floats "+gain". */
  gain: number;
  gainId: number;
};

/**
 * The coin balance in Today's header. Each time coins are earned it plays a short "ching"
 * (silent when the phone is on silent, and mixed with any music rather than pausing it),
 * gives a light haptic, bounces and floats a "+N" above itself. With reduced motion the
 * number simply updates.
 */
export function CoinCounter({ coins, gain, gainId }: Props) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  const player = useAudioPlayer(CHING);
  const bounce = useSharedValue(1);
  const float = useSharedValue(0);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: false }).catch((error) => logger.error('coinAudioMode', error));
  }, []);

  useEffect(() => {
    if (gainId === 0) return;
    const timer = setTimeout(() => {
      try {
        player.seekTo(0);
        player.play();
      } catch (error) {
        logger.error('coinSound', error);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, CELEBRATE_DELAY_MS);
    if (!reduceMotion) {
      bounce.value = withDelay(
        CELEBRATE_DELAY_MS,
        withSequence(withTiming(1.25, { duration: 120 }), withSpring(1)),
      );
      float.value = 0;
      float.value = withDelay(
        CELEBRATE_DELAY_MS,
        withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
      );
    }
    return () => clearTimeout(timer);
    // Only a new gain celebrates; the player and shared values are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gainId]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ scale: bounce.value }] }));
  const popStyle = useAnimatedStyle(() => ({
    opacity: float.value === 0 ? 0 : 1 - float.value,
    transform: [{ translateY: -28 * float.value }],
  }));

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${coins} ${coins === 1 ? 'coin' : 'coins'}`}
      accessibilityLiveRegion="polite">
      <Animated.View style={[styles.pill, { backgroundColor: colors.honeyTint }, pillStyle]}>
        <View style={[styles.coin, { backgroundColor: colors.honey, borderColor: colors.honeyInk }]} />
        <AppText variant="button" color="honeyInk">
          {coins}
        </AppText>
      </Animated.View>
      {gain > 0 && (
        <Animated.View pointerEvents="none" style={[styles.pop, popStyle]}>
          <AppText variant="label" color="honeyInk">
            +{gain}
          </AppText>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 44,
    minWidth: 64,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  coin: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  pop: { position: 'absolute', top: -4, left: 0, right: 0, alignItems: 'center' },
});
