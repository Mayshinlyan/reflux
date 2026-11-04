import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { SHEET_GUTTER } from '@/components/BottomSheet';
import { CUISINES, type CuisineKey } from '@/constants/cuisines';
import { cardEdge, radius, space, useColors } from '@/theme';

import { CuisineIcon } from './CuisineIcon';

type Props = {
  value: CuisineKey;
  onChange: (cuisine: CuisineKey) => void;
};

const CIRCLE = 64;
const TILE_W = 72;
const ICON = 43;
const GAP = space.s1;
/** The tap motion (Figma 37c), copied from the food app: about 120ms, ease out. */
const TAP_MS = 120;
const POP = 0.1;
/** Clockwise, so the drawing leans to the right. */
const TILT_DEG = 12;

/**
 * The cuisine picker (Figma row 37): round illustrated tiles that scroll sideways, straight on the sheet. It runs to
 * the sheet's edges, so the last tile is cut off and shows there is more, and it opens scrolled to the chosen cuisine.
 */
export function CuisineStrip({ value, onChange }: Props) {
  const scroll = useRef<ScrollViewInstance>(null);

  // Open with the chosen tile in view (on iOS and Android alike): one tile is its width plus the gap, and the first
  // tile or two need no scroll.
  useEffect(() => {
    const index = CUISINES.findIndex((cuisine) => cuisine.key === value);
    scroll.current?.scrollTo({ x: Math.max(0, index - 1) * (TILE_W + GAP), animated: false });
    // Only on open: picking a tile never moves the strip under the finger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.wrap}>
      <AppText variant="label" color="inkSoft" style={styles.label}>
        Cuisine
      </AppText>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="radiogroup"
        accessibilityLabel="Cuisine"
        style={styles.scroll}
        contentContainerStyle={styles.content}>
        {CUISINES.map((option) => (
          <Tile
            key={option.key}
            cuisine={option.key}
            name={option.label}
            selected={option.key === value}
            onPress={() => onChange(option.key)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * One tile: a cream circle with the soft edge. The chosen one is marked by a 2pt olive ring that only fades in and
 * out (it never changes size) while the drawing pops a little bigger and tilts. The name never moves or resizes.
 */
function Tile({
  cuisine,
  name,
  selected,
  onPress,
}: {
  cuisine: CuisineKey;
  name: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  const chosen = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    chosen.value = withTiming(selected ? 1 : 0, {
      duration: reduceMotion ? 0 : TAP_MS,
      easing: Easing.out(Easing.quad),
    });
  }, [selected, reduceMotion, chosen]);

  const ringStyle = useAnimatedStyle(() => ({ opacity: chosen.value }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + POP * chosen.value },
      { rotate: `${(reduceMotion ? 0 : TILT_DEG) * chosen.value}deg` },
    ],
  }));

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={name}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={styles.tile}>
      <View style={[styles.circle, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
        <Animated.View
          pointerEvents="none"
          style={[styles.ring, { borderColor: colors.sageInk }, ringStyle]}
        />
        <Animated.View style={iconStyle}>
          <CuisineIcon cuisine={cuisine} size={ICON} />
        </Animated.View>
      </View>
      <AppText variant="caption" color={selected ? 'ink' : 'inkSoft'} numberOfLines={2} style={styles.name}>
        {name}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Reach the sheet's edges: the sheet pads its content by `SHEET_GUTTER` on each side.
  wrap: { marginHorizontal: -SHEET_GUTTER, paddingBottom: 4 },
  label: { marginBottom: space.s1, marginLeft: SHEET_GUTTER },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: SHEET_GUTTER, gap: GAP },
  tile: { width: TILE_W, alignItems: 'center', gap: 6 },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  name: { textAlign: 'center' },
});
