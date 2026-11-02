import { type ReactNode, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { CarouselDots } from '@/components/CarouselDots';
import { space } from '@/theme';

const GAP = 12;
/** How much of the next card shows beside the current one, so it is clear there are more to swipe to. */
const PEEK = 32;

type Props<T> = {
  items: readonly T[];
  /** The card itself. Give it `flex: 1` so the cards in a row are all as tall as the tallest. */
  renderItem: (item: T, index: number) => ReactNode;
  /** What a screen reader says about card `index`, e.g. "Step 2 of 6: ...". */
  labelOf: (item: T, index: number) => string;
  keyOf: (item: T, index: number) => string;
};

/**
 * A row of cards to swipe (Figma row 29d and 29e): one card at a time snaps into place with a peek of the next, and
 * the carousel dots sit under it (each dot goes to its card). Used for the three recipe ideas and for a recipe's
 * steps. It is as wide as the screen's 24pt margins allow, so it belongs inside a padded screen or sheet.
 */
export function SnapCards<T>({ items, renderItem, labelOf, keyOf }: Props<T>) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(1);
  const scroll = useRef<ScrollViewInstance>(null);
  const cardWidth = Math.min(width - space.s3 * 2, 480) - PEEK;
  const step = cardWidth + GAP;
  const onEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.min(items.length, Math.max(1, Math.round(event.nativeEvent.contentOffset.x / step) + 1)));
  const goTo = (next: number) => {
    scroll.current?.scrollTo({ x: (next - 1) * step, animated: true });
    setPage(next);
  };
  return (
    <View>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        onMomentumScrollEnd={onEnd}
        contentContainerStyle={styles.row}>
        {items.map((item, index) => (
          <View
            key={keyOf(item, index)}
            // A group label, not an accessible element: a card holds a button that must stay reachable.
            accessibilityLabel={labelOf(item, index)}
            style={{ width: cardWidth }}>
            {renderItem(item, index)}
          </View>
        ))}
      </ScrollView>
      {items.length > 1 && <CarouselDots page={page} total={items.length} onSelect={goTo} />}
    </View>
  );
}

const styles = StyleSheet.create({ row: { gap: GAP } });
