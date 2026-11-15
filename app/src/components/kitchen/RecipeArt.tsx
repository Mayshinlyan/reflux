import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Belly } from '@/components/Belly';
import { isLook, LOOKS } from '@/lib/recipeLook';
import { type ColorToken, radius, useColors } from '@/theme';

type Props = {
  /** Which of the five looks (see lib/recipeLook). */
  look: number;
  height: number;
  /** Width in points; omit to fill the parent. */
  width?: number;
  /** No rounded corners, for a picture that fills the top of a card (the card rounds it). */
  square?: boolean;
};

/**
 * The picture on a recipe card, the recipe page and the saved list (Figma row 29d2): Bellie peeking out of a bowl, a
 * soup pot, a plate, a mug or a noodle bowl, each on its own colour. Every shape is a plain View, so it is crisp at
 * any size. It is decoration, so a screen reader skips it.
 */
export function RecipeArt({ look, height, width, square = false }: Props) {
  const colors = useColors();
  const safe = isLook(look) ? look : 0;
  const bs = Math.round(height * 0.57);
  const bellyTop = Math.round(height * 0.16);

  /** A shape placed from the horizontal centre: `dx` is its own centre's offset from the middle. */
  const at = (
    dx: number,
    top: number,
    w: number,
    h: number,
    color: ColorToken,
    extra: ViewStyle = {},
  ): ViewStyle => ({
    position: 'absolute',
    top,
    left: '50%',
    marginLeft: dx - w / 2,
    width: w,
    height: h,
    backgroundColor: colors[color],
    ...extra,
  });
  const belly = (
    <View style={[styles.belly, { top: bellyTop, width: bs, marginLeft: -bs / 2 }]}>
      <Belly mood="happy" size={bs} />
    </View>
  );

  const shapes = (() => {
    if (safe === 0) {
      // bowl
      const w = Math.round(bs * 1.5);
      const top = bellyTop + Math.round(bs * 0.78);
      return (
        <>
          {belly}
          <View
            style={at(0, top, w, Math.round(bs * 0.62), 'clay', {
              borderBottomLeftRadius: w / 2,
              borderBottomRightRadius: w / 2,
            })}
          />
          <View style={at(0, top - 4, w + 14, 8, 'clayInk', { borderRadius: 4 })} />
        </>
      );
    }
    if (safe === 1) {
      // soup pot with handles and steam
      const w = Math.round(bs * 1.5);
      const top = bellyTop + Math.round(bs * 0.74);
      return (
        <>
          <View style={at(-(w / 2 + 1), top + 10, 22, 22, 'cta', { borderRadius: 11 })} />
          <View style={at(w / 2 + 1, top + 10, 22, 22, 'cta', { borderRadius: 11 })} />
          {belly}
          <View style={at(0, top, w, Math.round(bs * 0.74), 'cta', { borderRadius: 14 })} />
          <View style={at(0, top - 4, w + 10, 10, 'surface', { borderRadius: 5 })} />
          {[-1, 1].flatMap((side) =>
            [0, 1].map((k) => (
              <View
                key={`${side}-${k}`}
                style={at(
                  side * (bs * 0.62 * 1.05) + k * 12 + 3 - 3,
                  bellyTop + 6 + k * 14,
                  6,
                  24,
                  'surface',
                  {
                    borderRadius: 3,
                    opacity: 0.85,
                  },
                )}
              />
            )),
          )}
        </>
      );
    }
    if (safe === 2) {
      // plate with a few bites
      const w = Math.round(bs * 2);
      const top = bellyTop + Math.round(bs * 0.84);
      return (
        <>
          {belly}
          <View style={at(0, top, w, Math.round(bs * 0.4), 'surface', { borderRadius: 999 })} />
          <View style={at(0, top + 6, w * 0.64, Math.round(bs * 0.26), 'surface2', { borderRadius: 999 })} />
          <View style={at(-26, top + 14, 16, 16, 'good', { borderRadius: 8 })} />
          <View style={at(14, top + 18, 16, 16, 'honey', { borderRadius: 8 })} />
          <View style={at(41, top + 12, 14, 14, 'sage', { borderRadius: 7 })} />
        </>
      );
    }
    if (safe === 3) {
      // mug with steam
      const w = Math.round(bs * 1.05);
      const h = Math.round(bs * 0.9);
      const top = bellyTop + Math.round(bs * 0.7);
      return (
        <>
          <View
            style={[
              at(w / 2 + 5, top + 14, 34, 40, 'clay', { borderRadius: 20, backgroundColor: 'transparent' }),
              { borderWidth: 9, borderColor: colors.clay },
            ]}
          />
          {belly}
          <View
            style={at(0, top, w, h, 'clay', {
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
              borderBottomLeftRadius: 22,
              borderBottomRightRadius: 22,
            })}
          />
          <View style={at(0, top - 3, w + 8, 8, 'clayInk', { borderRadius: 4 })} />
          {[0, 1, 2].map((k) => (
            <View
              key={k}
              style={at(-(w / 2 + 23 + k * 14), bellyTop + 20 + k * 10, 6, 26, 'surface', {
                borderRadius: 3,
                opacity: 0.85,
              })}
            />
          ))}
        </>
      );
    }
    // noodle bowl with chopsticks
    const w = Math.round(bs * 1.5);
    const top = bellyTop + Math.round(bs * 0.74);
    return (
      <>
        {belly}
        <View
          style={at(0, top, w, Math.round(bs * 0.66), 'honey', {
            borderBottomLeftRadius: w / 2,
            borderBottomRightRadius: w / 2,
          })}
        />
        <View style={at(0, top - 4, w + 14, 8, 'honeyInk', { borderRadius: 4 })} />
        <View style={at(-(w / 2 - 21), top - 8, 34, 10, 'surface', { borderRadius: 5 })} />
        <View style={at(w / 2 - 21, top - 8, 34, 10, 'surface', { borderRadius: 5 })} />
        <View
          style={at(w / 2 - 7, bellyTop + 8, 6, Math.round(bs * 1.15), 'ink', {
            borderRadius: 3,
            transform: [{ rotate: '-18deg' }],
          })}
        />
        <View
          style={at(w / 2 + 9, bellyTop + 14, 6, Math.round(bs * 1.15), 'ink', {
            borderRadius: 3,
            transform: [{ rotate: '-18deg' }],
          })}
        />
      </>
    );
  })();

  return (
    <View
      testID={`recipe-art-${safe}`}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.box,
        square && styles.square,
        { height, width, backgroundColor: colors[LOOKS[safe]!.tint] },
      ]}>
      {shapes}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, overflow: 'hidden' },
  square: { borderRadius: 0 },
  belly: { position: 'absolute', left: '50%', alignItems: 'center' },
});
