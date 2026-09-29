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
