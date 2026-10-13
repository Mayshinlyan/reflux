import { cleanCustomSymptom, CUSTOM_PREFIX } from '@/constants/symptomItems';

/** Lifestyle factors that can be tagged on a symptom log. Keys are stored; never rename. */
export const LIFESTYLE_TAGS = [
  { key: 'stress', label: 'Stress' },
  { key: 'lay_down_after_eating', label: 'Lay down after eating' },
  { key: 'large_meal', label: 'Large meal' },
  { key: 'alcohol', label: 'Alcohol' },
  { key: 'exercise', label: 'Exercise' },
  { key: 'poor_sleep', label: 'Poor sleep' },
] as const;

export type LifestyleTagKey = (typeof LIFESTYLE_TAGS)[number]['key'];
export const LIFESTYLE_TAG_KEYS = LIFESTYLE_TAGS.map((tag) => tag.key) as LifestyleTagKey[];

/**
 * A lifestyle factor the user typed is stored as `custom:<text>` in the same column as the built-in keys,
 * the same way a symptom of their own is, so entries and History treat it like any other tag.
 */
export type CustomTagKey = `custom:${string}`;
export type LoggedTagKey = LifestyleTagKey | CustomTagKey;

export const isCustomTag = (key: string): key is CustomTagKey => key.startsWith(CUSTOM_PREFIX);

/**
 * The key for a factor typed in the "+" chip: the built-in tag when it names one (so typing "stress" picks
 * Stress), otherwise a custom key. Null when nothing usable was typed.
 */
export function tagKeyFromText(text: string): LoggedTagKey | null {
  const clean = cleanCustomSymptom(text);
  if (!clean) return null;
  const builtIn = LIFESTYLE_TAGS.find((tag) => tag.label.toLowerCase() === clean.toLowerCase());
  return builtIn ? builtIn.key : `${CUSTOM_PREFIX}${clean}`;
}
