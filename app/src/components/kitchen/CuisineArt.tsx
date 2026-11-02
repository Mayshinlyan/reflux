import { StyleSheet, View } from 'react-native';

import { Belly } from '@/components/Belly';
import { CUISINE_TINT, type CuisineKey } from '@/constants/cuisines';
import { radius, useColors } from '@/theme';

type Props = {
  cuisine: CuisineKey;
  height: number;
  /** Width in points; omit to fill the parent. */
  width?: number;
};

/**
 * The picture on a recipe card and the recipe page (Figma row 29d, 29e): Bellie peeking out of a bowl, on a colour
 * that belongs to the cuisine. The colours stand in for a drawing per cuisine; the bowl and Bellie are the same
 * for all. It is decoration, so a screen reader skips it.
 */
export function CuisineArt({ cuisine, height, width }: Props) {
  const colors = useColors();
  const belly = Math.round(height * 0.57);
  const bellyTop = Math.round(height * 0.18);
  const bowlWidth = Math.round(belly * 1.5);
  const bowlTop = bellyTop + Math.round(belly * 0.78);
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.box, { height, width, backgroundColor: colors[CUISINE_TINT[cuisine]] }]}>
      <View style={[styles.belly, { top: bellyTop }]}>
        <Belly mood="happy" size={belly} />
      </View>
      <View
        style={[
          styles.bowl,
          {
            top: bowlTop,
            width: bowlWidth,
            height: Math.round(belly * 0.62),
            borderBottomLeftRadius: bowlWidth / 2,
            borderBottomRightRadius: bowlWidth / 2,
            backgroundColor: colors.clay,
          },
        ]}
      />
      <View
        style={[styles.rim, { top: bowlTop - 4, width: bowlWidth + 14, backgroundColor: colors.clayInk }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, overflow: 'hidden', alignItems: 'center' },
  belly: { position: 'absolute', alignItems: 'center' },
  bowl: { position: 'absolute' },
  rim: { position: 'absolute', height: 8, borderRadius: 4 },
});
