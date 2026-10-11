import type { AppVerdict } from '@/types/analysis';

export type BellyMood = 'happy' | 'okay' | 'caution' | 'avoid';

/** The belly's mood follows a meal's verdict; with no verdict (or no meal) it is simply happy. */
export function bellyMoodFor(verdict?: AppVerdict | null): BellyMood {
  switch (verdict) {
    case 'ok':
      return 'okay';
    case 'caution':
      return 'caution';
    case 'trigger':
      return 'avoid';
    default:
      return 'happy';
  }
}

export const BELLY_MOOD_LABEL: Record<BellyMood, string> = {
  happy: 'Belly feels happy',
  okay: 'Belly feels okay',
  caution: 'Belly feels cautious',
  avoid: 'Belly feels unwell',
};
