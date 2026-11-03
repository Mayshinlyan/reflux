import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { minTouchTarget, useColors } from '@/theme';

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

const TRACK_W = 51;
const TRACK_H = 31;
const THUMB = 27;
const INSET = 2;
const TRAVEL = TRACK_W - THUMB - INSET * 2;

/**
 * Figma "Switch" (51 x 31): an olive track with a cream thumb. It replaces React Native's `Switch`, whose layout box
 * does not match the iOS control and left it sitting high and stretched in its row.
 */
export function Toggle({ value, onValueChange, accessibilityLabel, disabled = false }: Props) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  const position = useSharedValue(value ? TRAVEL : 0);

  useEffect(() => {
    position.value = withTiming(value ? TRAVEL : 0, { duration: reduceMotion ? 0 : 160 });
  }, [value, reduceMotion, position]);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: position.value }] }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={{
        top: (minTouchTarget - TRACK_H) / 2,
        bottom: (minTouchTarget - TRACK_H) / 2,
        left: 4,
        right: 4,
      }}
      style={[styles.track, { backgroundColor: value ? colors.cta : colors.surface2 }]}>
      <Animated.View style={[styles.thumb, { backgroundColor: colors.surface }, thumbStyle]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    padding: INSET,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
