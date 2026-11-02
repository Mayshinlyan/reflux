import type { ColorToken } from '@/theme';
import type { Recipe } from '@/types/recipe';

/**
 * The five looks of a recipe's picture (Figma row 29d2): a dish with Bellie peeking out, each on its own colour.
 * They are handed out by position, not by cuisine, so the three ideas of a round never share one.
 */
export const LOOKS = [
  { key: 'bowl', tint: 'clayTint' },
  { key: 'pot', tint: 'honeyTint' },
  { key: 'plate', tint: 'mintTint' },
  { key: 'mug', tint: 'skyTint' },
  { key: 'noodles', tint: 'roseTint' },
] as const satisfies readonly { key: string; tint: ColorToken }[];

export const LOOK_COUNT = LOOKS.length;

export type LookKey = (typeof LOOKS)[number]['key'];

/**
 * The look for the idea at `index` (0 to 2) of round number `round`. Three in a row never repeat (there are five),
 * and each round starts further along, so the next round does not open on the same picture.
 */
export function lookForRound(round: number, index: number): number {
  return (Math.max(0, Math.floor(round)) * 3 + index) % LOOK_COUNT;
}

/** A stable number from a name, for a recipe saved before looks existed. */
function hash(text: string): number {
  let value = 0;
  for (let i = 0; i < text.length; i += 1) value = (value * 31 + text.charCodeAt(i)) >>> 0;
  return value;
}

export const isLook = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < LOOK_COUNT;

/** The recipe's own look, or one worked out from its name so it always looks the same. */
export function lookFor(recipe: Pick<Recipe, 'title' | 'look'>): number {
  return isLook(recipe.look) ? recipe.look : hash(recipe.title) % LOOK_COUNT;
}
