import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { type BellyMood } from '@/lib/belly';
import { arcPath, ringSegments } from '@/lib/ringSegments';
import { verdictColors, useColors } from '@/theme';
import type { AppVerdict } from '@/types/analysis';

import { AppText } from './AppText';
import { Belly } from './Belly';

const SIZE = 260;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;

type Props = {
  /** Today's meals, oldest first; each arc takes its verdict's colour. */
  meals: { verdict: AppVerdict | null }[];
  mood: BellyMood;
  /** Tapping the empty ring starts a meal log. */
  onPressEmpty: () => void;
};

/** Figma "Home ring": a track with one arc per meal today, and the belly with a short line in the middle. */
export function HomeRing({ meals, mood, onPressEmpty }: Props) {
  const colors = useColors();
  const count = meals.length;
  const segments = ringSegments(count);

  const ring = (
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
        {count === 0 ? (
          <>
            <Belly mood={mood} size={96} />
            <AppText variant="bodyEm">Log a meal</AppText>
            <AppText variant="voiceSmall" color="inkSoft">
              What&apos;s on your plate?
            </AppText>
          </>
        ) : (
          <>
            <Belly mood={mood} size={56} />
            <AppText variant="display">
              {count} {count === 1 ? 'meal' : 'meals'}
            </AppText>
            <AppText variant="caption" color="inkSoft">
              logged today
            </AppText>
          </>
        )}
      </View>
    </View>
  );

  if (count > 0) {
    return (
      <View accessible accessibilityLabel={`${count} ${count === 1 ? 'meal' : 'meals'} logged today`}>
        {ring}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Log a meal"
      accessibilityHint="What's on your plate?"
      onPress={onPressEmpty}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {ring}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: 12 },
});
