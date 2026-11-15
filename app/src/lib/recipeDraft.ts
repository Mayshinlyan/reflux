import type { CuisineKey } from '@/constants/cuisines';
import type { PlanMode } from '@/constants/mealPlan';
import type { Recipe } from '@/types/recipe';

/**
 * Set when the recipe is a meal of the week plan: how long the dish keeps, and which way the week is cooked. The
 * recipe page then adds the meal-prep card (portions, how long it keeps, reheating).
 */
export type RecipePrep = { keepsDays: number; mode: PlanMode };

/**
 * The recipe the person just picked from the ideas or the week plan, held in memory for the recipe page to show. A
 * recipe that was saved is opened by its id instead, so this is only for one not saved (yet). It is gone when the app
 * closes.
 */
export type RecipeDraft = { recipe: Recipe; cuisine: CuisineKey; prep?: RecipePrep };

let draft: RecipeDraft | null = null;

export function setRecipeDraft(next: RecipeDraft | null): void {
  draft = next;
}

export function getRecipeDraft(): RecipeDraft | null {
  return draft;
}
