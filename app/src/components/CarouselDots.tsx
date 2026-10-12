import { StyleSheet, View } from 'react-native';

import { useColors } from '@/theme';

/** Figma "Carousel dots": ticks under a swipeable card row. The long olive one is the card in view. `page` is 1-based. */
export function CarouselDots({ page, total }: { page: number; total: number }) {
  const colors = useColors();
  return (
    <View
      accessible
      accessibilityLabel={`Card ${page} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: page }}
      style={styles.row}>
      {Array.from({ length: total }, (_, i) =>
        i + 1 === page ? (
          <View key={i} style={[styles.active, { backgroundColor: colors.cta }]} />
        ) : (
          <View key={i} style={[styles.tick, { backgroundColor: colors.inkSoft }]} />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, height: 24 },
  active: { width: 6, height: 24, borderRadius: 3 },
  tick: { width: 3, height: 14, borderRadius: 1.5, opacity: 0.45 },
});
