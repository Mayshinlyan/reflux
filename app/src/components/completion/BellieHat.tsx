import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useColors } from '@/theme';

/**
 * Bellie's little hat (Figma G4b): a rose dome with a clay brim and a honey pom. Drawn on its own 120 x 92 box so it
 * can sit on top of the Belly at any size; `size` is the width.
 */
export function BellieHat({ size = 120 }: { size?: number }) {
  const colors = useColors();
  return (
    <Svg width={size} height={(size * 92) / 120} viewBox="0 0 120 92" accessible={false}>
      <Path d="M12 68 C12 40 32 24 60 24 C88 24 108 40 108 68 Z" fill={colors.clayTint} />
      <Rect x={0} y={66} width={120} height={12} rx={6} fill={colors.clay} />
      <Circle cx={60} cy={19} r={9} fill={colors.honey} />
    </Svg>
  );
}
