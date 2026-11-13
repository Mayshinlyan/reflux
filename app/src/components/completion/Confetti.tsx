import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion, ZoomIn } from 'react-native-reanimated';

import { useColors } from '@/theme';

// Offsets from the left edge of Figma's 402pt frame and from the top, as drawn (G1). `bar` pieces are rounded sticks.
const PIECES = [
  { x: 64, y: 168, bar: false, tone: 'honey' },
  { x: 320, y: 150, bar: false, tone: 'sage' },
  { x: 96, y: 296, bar: true, tone: 'good' },
  { x: 312, y: 272, bar: true, tone: 'honey' },
  { x: 48, y: 352, bar: false, tone: 'good' },
  { x: 344, y: 344, bar: false, tone: 'clay' },
  { x: 160, y: 120, bar: true, tone: 'sage' },
  { x: 250, y: 104, bar: false, tone: 'honey' },
  { x: 72, y: 232, bar: true, tone: 'clay' },
  { x: 336, y: 208, bar: false, tone: 'sage' },
  { x: 200, y: 80, bar: false, tone: 'clay' },
  { x: 288, y: 152, bar: true, tone: 'good' },
] as const;

const FRAME = 402;

/** A soft burst of confetti behind the page, decoration only. Still with Reduce Motion on. */
export function Confetti({ count = PIECES.length }: { count?: number }) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      importantForAccessibility="no-hide-descendants">
      {PIECES.slice(0, count).map((piece, index) => (
        <Animated.View
          key={`${piece.x}-${piece.y}`}
          entering={
            reduceMotion
              ? undefined
              : ZoomIn.delay(index * 45)
                  .springify()
                  .damping(12)
          }
          style={[styles.piece, { left: `${(piece.x / FRAME) * 100}%`, top: piece.y }]}>
          {/* The tilt sits on an inner view: a layout animation on the outer one would overwrite it. */}
          <View
            style={[
              piece.bar ? styles.bar : styles.dot,
              {
                backgroundColor: colors[piece.tone],
                transform: [{ rotate: piece.bar ? `${(index % 2 ? 1 : -1) * 28}deg` : '0deg' }],
              },
            ]}
          />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  bar: { width: 6, height: 17, borderRadius: 3 },
});
