import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { type ItemKey } from '@/lib/bellieItems';
import { type BellieStage } from '@/lib/bellieStage';
import { BELLY_MOOD_LABEL, type BellyMood } from '@/lib/belly';

import { useBellieStage, useBellieWorn } from './belly/BellieStageContext';
import { ITEM_ART, ITEM_DRAW_ORDER, itemRect } from './belly/items';
import { bellyLayout, bellySvg } from './belly/stages';

/** Below this size a Belly is a small icon and does not wear what was chosen on Customize Bellie. */
const MIN_DRESSED = 64;

type Props = {
  mood?: BellyMood;
  size?: number;
  /** The growth stage; by default the one Bellie has reached (see `BellieStageProvider`). */
  stage?: BellieStage;
  /** What Bellie wears; by default what was chosen on Customize Bellie. */
  worn?: readonly ItemKey[];
};

/**
 * The belly mascot (Figma "Belly"). Its mood follows a meal's verdict; it is not the pet. It is drawn at the stage
 * Bellie has grown to, standing on the bottom edge of a square box of `size` (a baby is smaller than an adult), with
 * whatever it was dressed in on top.
 */
export function Belly({ mood = 'happy', size = 120, stage, worn }: Props) {
  const currentStage = useBellieStage();
  const currentWorn = useBellieWorn();
  const shown = stage ?? currentStage;
  // Too small to see (the Kitchen icons, History's faces): nothing is drawn on top unless asked for.
  const wearing = worn ?? (size >= MIN_DRESSED ? currentWorn : []);
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
      {ITEM_DRAW_ORDER.filter((key) => wearing.includes(key)).map((key) => {
        const rect = itemRect(key, layout);
        return (
          <SvgXml
            key={key}
            xml={ITEM_ART[key].xml}
            width={rect.width}
            height={rect.height}
            style={{ position: 'absolute', left: rect.left, top: rect.top }}
          />
        );
      })}
    </View>
  );
}
