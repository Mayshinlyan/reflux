import { StyleSheet, View } from 'react-native';

import { useColors } from '@/theme';

/** Figma "Carousel dots": page dots under a swipeable card row. The long olive dot is the card in view. `page` is 1-based. */
export function CarouselDots({ page, total }: { page: number; total: number }) {
  const colors = useColors();
  return (
    <View
      accessible
      accessibilityLabel={`Card ${page} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: page }}
      style={styles.row}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i + 1 === page
              ? { width: 18, backgroundColor: colors.cta }
              : { width: 6, backgroundColor: colors.inkSoft },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dot: { height: 6, borderRadius: 3 },
});
