import { SvgXml } from 'react-native-svg';

import { BELLY_MOOD_LABEL, type BellyMood } from '@/lib/belly';

import { BELLY_SVG } from './belly/moods';

type Props = {
  mood?: BellyMood;
  size?: number;
};

/** The belly mascot (Figma "Belly"). Its mood follows a meal's verdict; it is not the pet. */
export function Belly({ mood = 'happy', size = 120 }: Props) {
  return (
    <SvgXml
      xml={BELLY_SVG[mood]}
      width={size}
      height={size}
      accessible
      accessibilityRole="image"
      accessibilityLabel={BELLY_MOOD_LABEL[mood]}
    />
  );
}
