import { Bird, Cat, Coffee, Flower2, type LucideIcon, Moon, Sprout, Sun } from 'lucide-react-native';

import type { ColorToken } from '@/theme/colors';

/** 'initial' shows the first letter of the name; the rest are icons. */
export type AvatarKey = 'initial' | 'sun' | 'moon' | 'sprout' | 'flower' | 'cat' | 'bird' | 'coffee';

type AvatarDef = {
  key: AvatarKey;
  label: string;
  /** Absent for the initial. */
  icon?: LucideIcon;
  tint: ColorToken;
  ink: ColorToken;
};

/**
 * The eight built-in avatars (Figma 06d), in display order. Every one has its own hue and its
 * own kind of subject; avatars.test.ts keeps repeats from creeping back in.
 */
export const AVATARS: AvatarDef[] = [
  { key: 'initial', label: 'Your initial', tint: 'clayTint', ink: 'clayInk' },
  { key: 'sun', label: 'Sun', icon: Sun, tint: 'honeyTint', ink: 'honeyInk' },
  { key: 'moon', label: 'Moon', icon: Moon, tint: 'lavenderTint', ink: 'lavenderInk' },
  { key: 'sprout', label: 'Sprout', icon: Sprout, tint: 'sageTint', ink: 'sageInk' },
  { key: 'flower', label: 'Flower', icon: Flower2, tint: 'roseTint', ink: 'roseInk' },
  { key: 'cat', label: 'Cat', icon: Cat, tint: 'mintTint', ink: 'mintInk' },
  { key: 'bird', label: 'Bird', icon: Bird, tint: 'skyTint', ink: 'skyInk' },
  { key: 'coffee', label: 'Coffee cup', icon: Coffee, tint: 'surface2', ink: 'inkSoft' },
];

export const AVATAR_KEYS = AVATARS.map((avatar) => avatar.key);

export function avatarDef(key: AvatarKey): AvatarDef {
  return AVATARS.find((avatar) => avatar.key === key) ?? AVATARS[0]!;
}
