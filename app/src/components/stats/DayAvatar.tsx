import { View } from 'react-native';

import type { BellyMood } from '@/lib/belly';
import type { DayState } from '@/lib/statsCards';
import { type ColorToken, useColors } from '@/theme';

import { Belly } from '../Belly';

/** Bellie on a disc in the same colours as the Food donut: green is no symptoms logged, yellow a few, red many. */
export const DAY_TONES: Record<
  Exclude<DayState, 'none'>,
  { disc: ColorToken; dot: ColorToken; mood: BellyMood }
> = {
  calm: { disc: 'goodTint', dot: 'good', mood: 'happy' },
  some: { disc: 'honeyTint', dot: 'honey', mood: 'okay' },
  lots: { disc: 'redTint', dot: 'red', mood: 'caution' },
};

/**
 * Figma row 28: one day as a Bellie on a tinted disc, or an empty ring when nothing was logged. The row or
 * cell it sits in says it in words, so the picture is hidden from a screen reader.
 */
export function DayAvatar({ state, size }: { state: DayState; size: number }) {
  const colors = useColors();
  const tone = state === 'none' ? null : DAY_TONES[state];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tone ? colors[tone.disc] : undefined,
        borderWidth: tone ? 0 : 2,
        borderColor: colors.surface2,
      }}>
      {tone ? <Belly mood={tone.mood} size={Math.round(size * 0.78)} /> : null}
    </View>
  );
}
