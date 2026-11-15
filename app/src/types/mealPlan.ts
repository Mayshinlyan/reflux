import type { ConditionKey } from '@/constants/conditions';
import type { CuisineKey } from '@/constants/cuisines';
import type { PlanMode, PlanSlot } from '@/constants/mealPlan';

import type { Recipe } from './recipe';

/** A dish in the plan: a recipe, plus how many days after cooking it still keeps in the fridge (0 = eat it that day). */
export type PlanDish = Recipe & { id: string; keepsDays: number };

/** One meal of the week: a day and a slot, pointing at the dish it is made from. */
export type PlanMealRef = { day: string; slot: PlanSlot; dish: string };

/** What the relay returns for a week plan (POST /v1/meal-plan). */
export type MealPlanResult = { dishes: PlanDish[]; meals: PlanMealRef[] };

/**
 * What is sent to plan a week: the set-up choices, what the person is managing, and food names only. Never symptom
 * logs, notes, photos or the person's name. Mirrors the relay's `mealPlanBodySchema`.
 */
export type MealPlanRequest = {
  mode: PlanMode;
  /** The meals still to plan: a day ("YYYY-MM-DD") and a slot each. */
  slots: { day: string; slot: PlanSlot }[];
  /** Titles of the dishes the person locked: kept as they are, planned around. */
  keep?: string[];
  cuisines: CuisineKey[];
  prepMinutes?: number;
  serves: number;
  conditions?: Exclude<ConditionKey, 'unsure'>[];
  fridge?: string[];
  favorites?: string[];
  triggers?: string[];
  avoid?: string[];
};
