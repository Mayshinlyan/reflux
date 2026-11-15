import type { StoredMeal } from '@/db/repositories/mealPlans';
import type { PlanDish } from '@/types/mealPlan';

import { addDays } from './localDay';
import { weekdayOf } from './mealPlan';

/**
 * The meals that are eaten (not "eating out"), which are the only ones the prep day and the list shop for. With `from`
 * (today), days already gone are left out too: a week that has started has meals behind it.
 */
export function eatenMeals<T extends { skipped: boolean; day: string }>(
  meals: readonly T[],
  from?: string,
): T[] {
  return meals.filter((meal) => !meal.skipped && (from === undefined || meal.day >= from));
}

export type PrepDish = { dish: PlanDish; meals: StoredMeal[] };

/** The dishes to cook, each with the meals that are eaten from it: longest dish first, so it goes on the heat first. */
export function prepDishes(meals: readonly StoredMeal[], from?: string): PrepDish[] {
  const byId = new Map<string, PrepDish>();
  for (const meal of eatenMeals(meals, from)) {
    const known = byId.get(meal.dishId);
    if (known) known.meals.push(meal);
    else byId.set(meal.dishId, { dish: meal.dish, meals: [meal] });
  }
  return [...byId.values()].sort((a, b) => b.dish.minutes - a.dish.minutes);
}

export type PrepStep = {
  /** Stays the same while the plan does, so a ticked step stays ticked. */
  key: string;
  text: string;
  /** Which dish it is for, or "All dishes". */
  caption: string;
};

export const PACK_KEY = 'pack';

/** Every dish's steps in the order they are listed, then one step to cool, pack and label. */
export function prepSteps(dishes: readonly PrepDish[]): PrepStep[] {
  const steps: PrepStep[] = dishes.flatMap(({ dish }) =>
    dish.steps.map((text, index) => ({ key: `${dish.id}:${index}`, text, caption: dish.title })),
  );
  if (steps.length > 0) {
    steps.push({ key: PACK_KEY, text: 'Cool everything, then pack and label', caption: 'All dishes' });
  }
  return steps;
}

/** The day to cook: the day before the first meal that is eaten. */
export function prepDay(meals: readonly StoredMeal[], weekStart: string, from?: string): string {
  const first = eatenMeals(meals, from)[0]?.day ?? weekStart;
  const before = addDays(first, -1);
  // With the first meal today, the cooking is today: there is no day before it left.
  return from !== undefined && before < from ? from : before;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Sunday", for the day to cook. */
export function prepDayName(dayKey: string): string {
  return WEEKDAYS[weekdayOf(dayKey)] ?? 'Prep';
}

/** "1 hour" or "2 hours", rounded to the half hour for a longer one: "about 2 hours". */
export function aboutHours(minutes: number): string {
  const hours = Math.max(1, Math.round(minutes / 30) / 2);
  return `about ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

/** "3 dishes, about 2 hours" */
export function prepSummary(dishes: readonly PrepDish[], prepMinutes: number): string {
  const count = `${dishes.length} ${dishes.length === 1 ? 'dish' : 'dishes'}`;
  return `${count}, ${aboutHours(prepMinutes)}`;
}

/**
 * Where each dish goes: the fridge when its last meal is within the days it keeps, the freezer when it would be
 * eaten later. Empty lines are left out.
 */
export function storingLines(dishes: readonly PrepDish[], cookDay: string): string[] {
  const fridge: string[] = [];
  const freezer: string[] = [];
  for (const { dish, meals } of dishes) {
    const last =
      meals
        .map((meal) => meal.day)
        .sort()
        .at(-1) ?? cookDay;
    const daysAfter = Math.round(
      (Date.parse(`${last}T00:00:00Z`) - Date.parse(`${cookDay}T00:00:00Z`)) / 86_400_000,
    );
    (daysAfter <= dish.keepsDays ? fridge : freezer).push(dish.title);
  }
  const lines: string[] = [];
  if (fridge.length > 0) lines.push(`Fridge: ${listOf(fridge)}.`);
  if (freezer.length > 0) lines.push(`Freezer: ${listOf(freezer)}.`);
  return lines;
}

function listOf(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
