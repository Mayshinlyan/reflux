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
import { cardEdge, radius, selectedFill, space, useColors } from '@/theme';

import { CuisineIcon } from './CuisineIcon';

type Props = {
  /** The cuisines chosen: one or more (the planner takes up to four; Any stands alone). */
  value: readonly CuisineKey[];
  /** A tile was tapped: the sheet decides what that does to the choice. */
  onToggle: (cuisine: CuisineKey) => void;
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
 * The cuisine picker (Figma row 37, and B8 and B9 for the week planner): round illustrated tiles that scroll sideways,
 * straight on the sheet. Every chosen cuisine gets the ring. It runs to the sheet's edges, so the last tile is cut off
 * and shows there is more, and it opens scrolled to the first chosen cuisine.
 */
export function CuisineStrip({ value, onToggle }: Props) {
  const scroll = useRef<ScrollViewInstance>(null);

  // Open with the chosen tile in view (on iOS and Android alike): one tile is its width plus the gap, and the first
  // tile or two need no scroll.
  useEffect(() => {
    const index = CUISINES.findIndex((cuisine) => value.includes(cuisine.key));
    scroll.current?.scrollTo({ x: Math.max(0, index - 1) * (TILE_W + GAP), animated: false });
    // Only on open: picking a tile never moves the strip under the finger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.wrap}>
      {/* The strip below carries the name for screen readers, so this one is not read out as well. */}
      <AppText
        variant="label"
        color="inkSoft"
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={styles.label}>
        Cuisine
      </AppText>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityLabel="Cuisine"
        style={styles.scroll}
        contentContainerStyle={styles.content}>
        {CUISINES.map((option) => (
          <Tile
            key={option.key}
            cuisine={option.key}
            name={option.label}
            selected={value.includes(option.key)}
            onPress={() => onToggle(option.key)}
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
      accessibilityRole="checkbox"
      accessibilityLabel={name}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={styles.tile}>
      <View style={[styles.circle, { backgroundColor: selectedFill(colors, selected), ...cardEdge(colors) }]}>
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
