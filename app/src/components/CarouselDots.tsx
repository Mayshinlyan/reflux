import { Pressable, StyleSheet, View } from 'react-native';

import { useColors } from '@/theme';

const DOT = 8;
/** The card in view is a wider pill, so it reads at a glance without relying on colour alone. */
const ACTIVE_WIDTH = 20;
const GAP = 8;
/** Every dot is a full-height tap target, and the row is as tall, so the dots are never hard to hit. */
export const DOTS_ROW = 44;

type Props = {
  /** The card in view, 1-based. */
  page: number;
  total: number;
  /** Tapping a dot (or a screen reader's up and down) goes to that card. Without it the dots only show where you are. */
  onSelect?: (page: number) => void;
};

/**
 * Figma "Carousel dots (round)": small round dots under a swipeable card row, the card in view a wider olive
 * pill. Sits under the cards, never on them. A screen reader hears "Card 2 of 4" and can adjust it up or down.
 */
export function CarouselDots({ page, total, onSelect }: Props) {
  const colors = useColors();
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`Card ${page} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: page }}
      accessibilityActions={onSelect ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
      onAccessibilityAction={(event) => {
        if (!onSelect) return;
        if (event.nativeEvent.actionName === 'increment') onSelect(Math.min(total, page + 1));
        if (event.nativeEvent.actionName === 'decrement') onSelect(Math.max(1, page - 1));
      }}
      style={styles.row}>
      {Array.from({ length: total }, (_, i) => {
        const active = i + 1 === page;
        return (
          <Pressable
            key={i}
            accessible={false}
            disabled={!onSelect}
            onPress={() => onSelect?.(i + 1)}
            style={[styles.target, { width: (active ? ACTIVE_WIDTH : DOT) + GAP }]}>
            <View
              testID={active ? 'dot-active' : 'dot'}
              style={
                active
                  ? [styles.dot, { width: ACTIVE_WIDTH, backgroundColor: colors.cta }]
                  : [styles.dot, { width: DOT, backgroundColor: colors.inkMuted }]
              }
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: DOTS_ROW },
  target: { height: DOTS_ROW, alignItems: 'center', justifyContent: 'center' },
  dot: { height: DOT, borderRadius: DOT / 2 },
});
