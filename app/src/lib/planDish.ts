import { isPlanSlot } from '@/constants/mealPlan';
import type { MealPlanResult, PlanDish } from '@/types/mealPlan';
import type { Recipe } from '@/types/recipe';

import { isRecipe, pickRecipe } from './recipe';

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** True when `value` has the shape of a plan dish: a recipe, an id and how many days it keeps. */
export function isPlanDish(value: unknown): value is PlanDish {
  if (!isRecipe(value)) return false;
  const dish = value as unknown as Record<string, unknown>;
  return (
    typeof dish.id === 'string' &&
    dish.id.length > 0 &&
    typeof dish.keepsDays === 'number' &&
    Number.isInteger(dish.keepsDays) &&
    dish.keepsDays >= 0
  );
}

/**
 * The relay's answer: dishes, and meals that each point at one of them. Anything that leaves a meal pointing at
 * nothing is refused here, so the phone never keeps a plan with a hole in it.
 */
export function isMealPlanResult(value: unknown): value is MealPlanResult {
  if (typeof value !== 'object' || value === null) return false;
  const { dishes, meals } = value as { dishes?: unknown; meals?: unknown };
  if (!Array.isArray(dishes) || dishes.length === 0 || !dishes.every(isPlanDish)) return false;
  if (!Array.isArray(meals) || meals.length === 0) return false;
  const ids = new Set((dishes as PlanDish[]).map((dish) => dish.id));
  return meals.every((meal) => {
    if (typeof meal !== 'object' || meal === null) return false;
    const { day, slot, dish } = meal as Record<string, unknown>;
    return (
      typeof day === 'string' &&
      DAY_KEY.test(day) &&
      isPlanSlot(slot) &&
      typeof dish === 'string' &&
      ids.has(dish)
    );
  });
}

/** Only the fields the app shows (see `pickRecipe`), plus the dish's id and how long it keeps. */
export function pickPlanDish(dish: PlanDish): PlanDish {
  return { ...pickRecipe(dish), id: dish.id, keepsDays: dish.keepsDays };
}

/** A single recipe (from a Swap) as a dish of its own: eaten the day it is cooked. */
export function dishFromRecipe(recipe: Recipe, id: string): PlanDish {
  return { ...pickRecipe(recipe), id, keepsDays: 0 };
}
