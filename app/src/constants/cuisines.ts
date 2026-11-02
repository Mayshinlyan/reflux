import type { ColorToken } from '@/theme';

/** The Kitchen's cuisines, A to Z with "Any" first (Figma row 29b2). Keys match the relay's `CUISINES`. */
export const CUISINES = [
  { key: 'any', label: 'Any' },
  { key: 'chinese', label: 'Chinese' },
  { key: 'indian', label: 'Indian' },
  { key: 'italian', label: 'Italian' },
  { key: 'japanese', label: 'Japanese' },
  { key: 'korean', label: 'Korean' },
  { key: 'mediterranean', label: 'Mediterranean' },
  { key: 'mexican', label: 'Mexican' },
  { key: 'thai', label: 'Thai' },
  { key: 'vietnamese', label: 'Vietnamese' },
] as const;

export type CuisineKey = (typeof CUISINES)[number]['key'];

export const CUISINE_KEYS: readonly CuisineKey[] = CUISINES.map((cuisine) => cuisine.key);

export const isCuisineKey = (value: unknown): value is CuisineKey =>
  typeof value === 'string' && (CUISINE_KEYS as readonly string[]).includes(value);

export function cuisineLabel(key: CuisineKey): string {
  return CUISINES.find((cuisine) => cuisine.key === key)?.label ?? 'Any';
}

/**
 * The colour behind each cuisine's Bellie art. Every cuisine has its own, so a list of ideas never repeats a
 * background. These tints stand in for the cuisine illustrations until those are drawn.
 */
export const CUISINE_TINT: Record<CuisineKey, ColorToken> = {
  any: 'surface2',
  chinese: 'redTint',
  indian: 'honeyTint',
  italian: 'goodTint',
  japanese: 'roseTint',
  korean: 'clayTint',
  mediterranean: 'skyTint',
  mexican: 'lavenderTint',
  thai: 'mintTint',
  vietnamese: 'sageTint',
};

/** "Ready in": a limit on the total time, prep included. Keys match the relay's `RECIPE_TIMES`. */
export const RECIPE_TIMES = [
  { value: '20', label: '20 min' },
  { value: '40', label: '40 min' },
  { value: 'long', label: '1 hr+' },
] as const;

export type RecipeTime = (typeof RECIPE_TIMES)[number]['value'];

export const isRecipeTime = (value: unknown): value is RecipeTime =>
  typeof value === 'string' && RECIPE_TIMES.some((time) => time.value === value);

export const MIN_SERVES = 1;
export const MAX_SERVES = 6;
