import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useBellyJiggle } from '@/hooks/useBellyJiggle';
import { type BellyMood } from '@/lib/belly';
import { JIGGLE_MS } from '@/lib/bellyMotion';

import { Belly } from './Belly';
import { SpeechBubble } from './SpeechBubble';

const BELLY_SIZE = 160;
/** The bubble wraps long lines inside this width (Figma 02f). */
const BUBBLE_MAX = 280;

type Props = {
  /** What Bellie says: her summary line, or "Tap me to log" before anything is logged. */
  line: string;
  mood: BellyMood;
  /** Tapping Bellie opens the food screen, once she has jiggled. */
  onPress: () => void;
};

/**
 * Figma "02f Home": a big Bellie under a speech bubble that carries her line. She is the way into logging: she
 * squashes and tilts under a finger and jiggles on a tap, then the Food screen opens.
 */
export function HomeBellie({ line, mood, onPress }: Props) {
  const jiggle = useBellyJiggle(BELLY_SIZE, BELLY_SIZE);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    [],
  );

  const handlePress = () => {
    if (pending.current) return;
    if (jiggle.reduceMotion) return onPress();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    jiggle.play();
    // Let the jiggle be seen before the next screen covers it.
    pending.current = setTimeout(() => {
      pending.current = null;
      onPress();
    }, JIGGLE_MS);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Log"
      accessibilityValue={{ text: line }}
      accessibilityHint="Opens the food screen"
      onPressIn={jiggle.pressIn}
      onPressOut={jiggle.pressOut}
      onPress={handlePress}>
      <View style={styles.wrap}>
        <View style={styles.bubble}>
          <SpeechBubble card tail="down" text={line} />
        </View>
        <Animated.View style={jiggle.style}>
          <Belly mood={mood} size={BELLY_SIZE} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8 },
  bubble: { maxWidth: BUBBLE_MAX },
});
