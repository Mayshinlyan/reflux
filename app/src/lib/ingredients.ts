import type { MealAnalysis, MealItem } from '@/types/analysis';

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

/** Every ingredient name across the meal's items, without repeats, as one editable line. */
export function formatIngredients(analysis: MealAnalysis): string {
  return parseIngredients(
    analysis.items.flatMap((item) => item.ingredients.map((ingredient) => ingredient.name)).join(','),
  ).join(', ');
}

/** The names in an edited ingredient line: split on commas, trimmed, blanks and repeats dropped. */
export function parseIngredients(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(',')
    .map((name) => name.trim())
    .filter((name) => {
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * The analysis with its ingredients replaced by `names`. An ingredient that stays keeps its matched trigger
 * categories; a new one is added to the first item without any. The verdicts are not recomputed, so they
 * are stale until the meal is checked again.
 */
export function withIngredients(analysis: MealAnalysis, names: string[]): MealAnalysis {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const kept = new Set<string>();
  const items = analysis.items.map((item) => ({
    ...item,
    ingredients: item.ingredients.filter((ingredient) => {
      const key = ingredient.name.toLowerCase();
      if (!wanted.has(key) || kept.has(key)) return false;
      kept.add(key);
      return true;
    }),
  }));
  const added = names.filter((name) => !kept.has(name.toLowerCase()));
  if (added.length > 0 && items.length > 0) {
    items[0] = {
      ...items[0],
      ingredients: [...items[0].ingredients, ...added.map((name) => ({ name, matchedCategories: [] }))],
    };
  }
  return { ...analysis, items };
}
