import type { Recipe } from '@/types/recipe';

import { isLook } from './recipeLook';

const isStringList = (value: unknown, min: number): value is string[] =>
  Array.isArray(value) &&
  value.length >= min &&
  value.every((item) => typeof item === 'string' && item.length > 0);

/** Where "Watch similar recipe on YouTube" goes: a YouTube search for the dish (opened in the in-app browser). */
export const videoSearchUrl = (title: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} recipe`)}`;

/** True when `value` has the shape of a `Recipe`: the relay's answer and a saved recipe are both checked with this. */
export function isRecipe(value: unknown): value is Recipe {
  if (typeof value !== 'object' || value === null) return false;
  const recipe = value as Record<string, unknown>;
  return (
    typeof recipe.title === 'string' &&
    recipe.title.length > 0 &&
    typeof recipe.minutes === 'number' &&
    Number.isFinite(recipe.minutes) &&
    typeof recipe.serves === 'number' &&
    Number.isFinite(recipe.serves) &&
    typeof recipe.why === 'string' &&
    typeof recipe.tip === 'string' &&
    isStringList(recipe.ingredients, 1) &&
    isStringList(recipe.steps, 1) &&
    // The look is the phone's own and optional; one that is not a real look is a bad recipe, not a crash later.
    (recipe.look === undefined || isLook(recipe.look))
  );
}

/** The relay's answer: a `recipes` list of at least one recipe. */
export function isRecipeIdeas(value: unknown): value is { recipes: Recipe[] } {
  if (typeof value !== 'object' || value === null) return false;
  const { recipes } = value as { recipes?: unknown };
  return Array.isArray(recipes) && recipes.length > 0 && recipes.every(isRecipe);
}

/** Only the fields the app shows, so nothing else the relay adds (like `meta`) gets saved. */
export function pickRecipe(recipe: Recipe): Recipe {
  const { title, minutes, serves, why, tip, ingredients, steps, look } = recipe;
  return {
    title,
    minutes,
    serves,
    why,
    tip,
    ingredients: [...ingredients],
    steps: [...steps],
    ...(isLook(look) ? { look } : {}),
  };
}

/** The relay's caps on what a request may carry (see its `recipeIdeasBodySchema`). */
export const MAX_WANT = 10;
export const MAX_WANT_ITEM = 40;
export const MAX_FOOD_NAME = 60;

/**
 * A food name the way the relay will clean it (no angle brackets, runs of spaces and line breaks become one space),
 * cut to its cap. Empty when nothing is left, so one odd typed entry is left out instead of making the relay reject
 * the whole request.
 */
export const cleanFoodName = (text: string, max: number = MAX_FOOD_NAME) =>
  text.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max).trim();

/** "rice, spinach, 2 eggs" or one per line, as a clean list of at most ten ingredients. */
export function parseWanted(text: string): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const part of text.split(/[,\n;]/)) {
    const item = cleanFoodName(part, MAX_WANT_ITEM);
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    if (items.length >= MAX_WANT) break;
  }
  return items;
}

/** "20 min", "1 hr", "1 hr 20 min". */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** "20 min · serves 2", the line under a recipe's name. */
export function recipeMeta(recipe: Pick<Recipe, 'minutes' | 'serves'>): string {
  return `${formatMinutes(recipe.minutes)} · serves ${recipe.serves}`;
}
