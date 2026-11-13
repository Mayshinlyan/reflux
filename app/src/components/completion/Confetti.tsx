import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

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
/** The burst pops in, hangs about a second, then drifts down and fades, so the page settles quietly. */
const HOLD_MS = 900;
const FALL_MS = 1400;
const FALL_PX = 72;

/**
 * A soft burst of confetti behind the page, decoration only: it pops in, then falls and fades. Still with Reduce
 * Motion on. `anchor` is where, in Figma's frame, the thing it surrounds starts (Bellie's top, 216): the pieces are
 * placed from it, so inside a wrapper around Bellie they travel with her wherever the page puts her.
 */
export function Confetti({ count = PIECES.length, anchor = 0 }: { count?: number; anchor?: number }) {
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      importantForAccessibility="no-hide-descendants">
      {PIECES.slice(0, count).map((piece, index) => (
        <ConfettiPiece key={`${piece.x}-${piece.y}`} piece={piece} index={index} anchor={anchor} />
      ))}
    </View>
  );
}

function ConfettiPiece({
  piece,
  index,
  anchor,
}: {
  piece: (typeof PIECES)[number];
  index: number;
  anchor: number;
}) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  const fall = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    fall.value = withDelay(
      HOLD_MS + index * 60,
      withTiming(1, { duration: FALL_MS, easing: Easing.in(Easing.quad) }),
    );
  }, [reduceMotion, index, fall]);

  const fallStyle = useAnimatedStyle(() => ({
    opacity: 1 - fall.value,
    transform: [{ translateY: fall.value * FALL_PX }],
  }));

  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : ZoomIn.delay(index * 15)
              .springify()
              .damping(12)
      }
      style={[styles.piece, { left: `${(piece.x / FRAME) * 100}%`, top: piece.y - anchor }]}>
      {/* The pop-in sits on the outer view, the fall on this one and the tilt on the inner one: each animation gets its own view so none overwrites another. */}
      <Animated.View style={fallStyle}>
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  bar: { width: 6, height: 17, borderRadius: 3 },
});
