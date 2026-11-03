import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';

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
const GAP = space.s1;

/**
 * The cuisine picker (Figma row 37): round illustrated tiles that scroll sideways. It runs to the sheet's edges, so the
 * last tile is cut off and shows there is more, and it opens scrolled to the chosen cuisine.
 */
export function CuisineStrip({ value, onChange }: Props) {
  const colors = useColors();
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
        {CUISINES.map((option) => {
          const selected = option.key === value;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option.key)}
              style={styles.tile}>
              <View
                style={[
                  styles.circle,
                  selected
                    ? { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.sageInk }
                    : { backgroundColor: colors.surface, ...cardEdge(colors) },
                ]}>
                <CuisineIcon cuisine={option.key} size={42} />
              </View>
              <AppText
                variant={selected ? 'bodyEm' : 'label'}
                color={selected ? 'sageInk' : 'ink'}
                numberOfLines={2}
                style={styles.name}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
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
  name: { textAlign: 'center' },
});
