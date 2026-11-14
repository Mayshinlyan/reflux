import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { type BellieStage } from '@/lib/bellieStage';
import { BELLY_MOOD_LABEL, type BellyMood } from '@/lib/belly';

import { useBellieStage } from './belly/BellieStageContext';
import { bellyLayout, bellySvg } from './belly/stages';

type Props = {
  mood?: BellyMood;
  size?: number;
  /** The growth stage; by default the one Bellie has reached (see `BellieStageProvider`). */
  stage?: BellieStage;
};

/**
 * The belly mascot (Figma "Belly"). Its mood follows a meal's verdict; it is not the pet. It is drawn at the stage
 * Bellie has grown to, standing on the bottom edge of a square box of `size` (a baby is smaller than an adult).
 */
export function Belly({ mood = 'happy', size = 120, stage }: Props) {
  const current = useBellieStage();
  const shown = stage ?? current;
  const layout = bellyLayout(shown, size);
  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={BELLY_MOOD_LABEL[mood]}>
      <SvgXml
        xml={bellySvg(shown, mood)}
        width={layout.width}
        height={layout.height}
        style={{ position: 'absolute', left: layout.left, top: layout.top }}
      />
    </View>
  );
}
