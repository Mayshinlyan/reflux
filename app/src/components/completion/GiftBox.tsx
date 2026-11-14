import { useCallback, useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Ellipse, Rect } from 'react-native-svg';

import { useColors } from '@/theme';

type Props = {
  size?: number;
  /** Wiggles now and then, asking to be opened. */
  wiggle?: boolean;
  /** Called once the pop has played (at once with Reduce Motion). */
  onOpen: () => void;
  accessibilityLabel?: string;
};

/** The wrapped gift (Figma G4) as a picture, in its own 200 box scaled to `size`. */
export function GiftArt({ size = 200 }: { size?: number }) {
  const colors = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Rect
        x={28}
        y={64}
        width={144}
        height={112}
        rx={14}
        fill={colors.honeyTint}
        stroke={colors.honey}
        strokeWidth={2}
      />
      <Rect x={20} y={32} width={160} height={44} rx={12} fill={colors.honey} />
      <Rect x={88} y={32} width={24} height={144} fill={colors.clay} />
      <Ellipse cx={80} cy={22} rx={23} ry={19} fill={colors.clay} rotation={-20} origin="80, 22" />
      <Ellipse cx={120} cy={16} rx={23} ry={19} fill={colors.clay} rotation={20} origin="120, 16" />
    </Svg>
  );
}

/**
 * The wrapped gift (Figma G4). Tapping it pops it open: it squeezes, then swells and fades, and `onOpen` fires so
 * the caller can show what was inside. Used on the gift page and for an unopened gift in Customize Bellie.
 */
export function GiftBox({ size = 200, wiggle = false, onOpen, accessibilityLabel = 'Open the gift' }: Props) {
  const reduceMotion = useReducedMotion();
  const tilt = useSharedValue(0);
  const pop = useSharedValue(1);
  const [opening, setOpening] = useState(false);
  const done = useCallback(() => onOpen(), [onOpen]);

  useEffect(() => {
    if (!wiggle || reduceMotion) return;
    tilt.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(-5, { duration: 120 }),
          withTiming(5, { duration: 120 }),
          withTiming(0, { duration: 120 }),
          withDelay(900, withTiming(0, { duration: 1 })),
        ),
        -1,
      ),
    );
  }, [wiggle, reduceMotion, tilt]);

  useEffect(() => {
    if (!opening) return;
    pop.value = withSequence(
      withTiming(0.88, { duration: 90 }),
      withTiming(1.45, { duration: 200 }, (finished) => {
        if (finished) runOnJS(done)();
      }),
    );
  }, [opening, pop, done]);

  const style = useAnimatedStyle(() => ({
    opacity: pop.value > 1 ? Math.max(0, 2.2 - pop.value * 1.5) : 1,
    transform: [{ rotate: `${tilt.value}deg` }, { scale: pop.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => (reduceMotion ? onOpen() : setOpening(true))}>
      <Animated.View style={style}>
        <GiftArt size={size} />
      </Animated.View>
    </Pressable>
  );
}
