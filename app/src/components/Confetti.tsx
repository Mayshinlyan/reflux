import { StyleSheet, View } from 'react-native';

import { type ColorToken, useColors } from '@/theme';

/** The Figma frame's content width; x positions below are scaled to the real width so narrow phones keep every piece on screen. */
const AREA_WIDTH = 354;

// Each piece: x (pt in a 354pt-wide area), y (pt from the top of the area; negative is above it), rotation (deg), colour.
// Copied from the Figma "01h Ready" scatter: mostly above the bubble, a few at the sides.
const PIECES: { x: number; y: number; rotate: number; color: ColorToken }[] = [
  { x: 40, y: -78, rotate: 20, color: 'cta' },
  { x: 96, y: -128, rotate: -15, color: 'clayTint' },
  { x: 160, y: -158, rotate: 35, color: 'sageTint' },
  { x: 226, y: -136, rotate: -25, color: 'honey' },
  { x: 290, y: -98, rotate: 15, color: 'cta' },
  { x: 322, y: -38, rotate: 40, color: 'clayTint' },
  { x: 12, y: 2, rotate: -30, color: 'sageTint' },
  { x: 70, y: -28, rotate: 10, color: 'honey' },
  { x: 270, y: -8, rotate: -10, color: 'cta' },
  { x: 330, y: 52, rotate: 25, color: 'clayTint' },
  { x: 24, y: 92, rotate: -20, color: 'sageTint' },
  { x: 300, y: 122, rotate: 30, color: 'honey' },
  { x: 120, y: -88, rotate: -40, color: 'cta' },
  { x: 212, y: -78, rotate: 20, color: 'clayTint' },
];

/** A light scatter of palette-coloured confetti for the closing onboarding screen. Decorative only. */
export function Confetti() {
  const colors = useColors();
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}>
      {PIECES.map((piece, i) => (
        <View
          key={i}
          style={[
            styles.piece,
            i % 3 === 0 ? styles.wide : styles.tall,
            {
              left: `${(piece.x / AREA_WIDTH) * 100}%`,
              top: piece.y,
              backgroundColor: colors[piece.color],
              transform: [{ rotate: `${piece.rotate}deg` }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', borderRadius: 2 },
  wide: { width: 14, height: 8 },
  tall: { width: 10, height: 14 },
});
