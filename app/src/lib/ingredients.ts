import type { MealItem } from '@/types/analysis';

type Ingredient = MealItem['ingredients'][number];

/** How many ingredients the card shows before "Show all". */
export const MAIN_INGREDIENT_LIMIT = 4;

/**
 * The short "main ingredients" line: every ingredient that matches a trigger category (the
 * reasoning cites them, so they are never hidden), then the rest in the order given until
 * `limit` is reached. The relay lists the most prominent ingredients first. Order is kept.
 */
export function mainIngredients(
  ingredients: Ingredient[],
  limit: number = MAIN_INGREDIENT_LIMIT,
): { shown: Ingredient[]; hiddenCount: number } {
  const triggers = ingredients.filter((ingredient) => ingredient.matchedCategories.length > 0);
  let room = Math.max(limit - triggers.length, 0);
  const shown = ingredients.filter((ingredient) => {
    if (ingredient.matchedCategories.length > 0) return true;
    if (room === 0) return false;
    room -= 1;
    return true;
  });
  return { shown, hiddenCount: ingredients.length - shown.length };
}
