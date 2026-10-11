import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { useBellyJiggle } from '@/hooks/useBellyJiggle';
import { type BellyMood } from '@/lib/belly';
import { JIGGLE_MS } from '@/lib/bellyMotion';
import { arcPath, ringSegments } from '@/lib/ringSegments';
import { verdictColors, useColors } from '@/theme';
import type { AppVerdict } from '@/types/analysis';

import { AppText } from './AppText';
import { Belly } from './Belly';
import { SpeechBubble } from './SpeechBubble';

const SIZE = 260;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;

type Props = {
  /** Today's meals, oldest first; each arc takes its verdict's colour. */
  meals: { verdict: AppVerdict | null }[];
  mood: BellyMood;
  /** Tapping the ring (the belly) opens the Log page, once the belly has jiggled. */
  onPress: () => void;
};

/**
 * Figma "Home ring": a track with one arc per meal today, and the belly in the middle. The belly is the
 * way into Log: it squashes and tilts under a finger and jiggles on a tap, then the Log page opens.
 */
export function HomeRing({ meals, mood, onPress }: Props) {
  const colors = useColors();
  const count = meals.length;
  const segments = ringSegments(count);
  const jiggle = useBellyJiggle(SIZE, SIZE);
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
      accessibilityLabel={count > 0 ? `Log, ${count} ${count === 1 ? 'meal' : 'meals'} logged today` : 'Log'}
      accessibilityHint="Opens the Log page"
      onPressIn={jiggle.pressIn}
      onPressOut={jiggle.pressOut}
      onPress={handlePress}>
      <View style={styles.ring}>
        <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill} accessibilityElementsHidden>
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={colors.surface2}
            strokeWidth={STROKE}
            fill="none"
          />
          {segments.map((segment, i) => {
            const verdict = meals[i]?.verdict;
            const stroke = verdict ? colors[verdictColors[verdict].accent] : colors.inkSoft;
            return count === 1 ? (
              <Circle
                key={i}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                stroke={stroke}
                strokeWidth={STROKE}
                fill="none"
              />
            ) : (
              <Path
                key={i}
                d={arcPath(CENTER, CENTER, RADIUS, segment)}
                stroke={stroke}
                strokeWidth={STROKE}
                fill="none"
              />
            );
          })}
        </Svg>
        <View style={styles.center}>
          <Animated.View style={jiggle.style}>
            <Belly mood={mood} size={96} />
          </Animated.View>
          {count === 0 ? (
            <SpeechBubble text="Tap me to log" />
          ) : (
            <View style={styles.count}>
              <AppText variant="display" style={styles.countText}>
                {count} {count === 1 ? 'meal' : 'meals'}
              </AppText>
              <AppText variant="caption" color="inkSoft">
                logged today
              </AppText>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: 8 },
  count: { alignItems: 'center', gap: 4 },
  // Smaller than the screen-title size (Figma "Belly/Display small"): Gaegu, 28/32.
  countText: { fontSize: 28, lineHeight: 32 },
});
