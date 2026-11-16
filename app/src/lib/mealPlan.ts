import type { ConditionKey } from '@/constants/conditions';
import {
  PLAN_SLOTS,
  type PlanChoices,
  type PlanMode,
  type PlanSlot,
  prepWeekday,
} from '@/constants/mealPlan';
import type { AppDb } from '@/db/types';
import type { NewMeal } from '@/db/repositories/mealPlans';
import type { MealPlanRequest, MealPlanResult } from '@/types/mealPlan';

import { foodLists, requestNames, sendableConditions } from './kitchen';
import { addDays } from './localDay';

export type PlanSlotRef = { day: string; slot: PlanSlot };

/** By JS weekday, 0 = Sunday. */
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** 0 (Sunday) to 6 (Saturday) for a "YYYY-MM-DD" day key. */
export function weekdayOf(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

/**
 * The Sunday a plan starts on, as on Today: this week's (which is today when it is a Sunday), or tomorrow's when today
 * is a Saturday (a plan for one day would be no plan, and the weekend is when people plan the week ahead).
 */
export function planWeekStart(today: string): string {
  const weekday = weekdayOf(today);
  return weekday === 6 ? addDays(today, 1) : addDays(today, -weekday);
}

/**
 * The date to cook on for a plan week. A week that starts on a Sunday: Sunday is its first day, Monday to Friday are
 * inside it, and Saturday is the day before it. Plans made before the week moved to Sunday start on a Monday and keep
 * their old reading: Sunday and Saturday are the days just before that Monday.
 */
export function prepDateFor(weekStart: string, weekday: number): string {
  if (weekdayOf(weekStart) === 1) {
    if (weekday === 0) return addDays(weekStart, -1);
    if (weekday === 6) return addDays(weekStart, -2);
    return addDays(weekStart, weekday - 1);
  }
  if (weekday === 6) return addDays(weekStart, -1);
  return addDays(weekStart, weekday);
}

export type PlanDay = { key: string; letter: string; name: string; date: number; weekday: number };

/** The seven days of a plan week, from its first day (a Sunday; a Monday for plans made before). */
export function planWeek(weekStart: string): PlanDay[] {
  return LETTERS.map((_, i) => {
    const key = addDays(weekStart, i);
    const weekday = weekdayOf(key);
    return {
      key,
      letter: LETTERS[weekday] ?? '',
      name: NAMES[weekday] ?? '',
      date: Number(key.slice(8, 10)),
      weekday,
    };
  });
}

/**
 * The meals to plan: every chosen meal on every chosen weekday of the week that has not passed yet, in the order
 * they are eaten.
 */
export function planSlots(
  choices: Pick<PlanChoices, 'weekdays' | 'meals'> & Partial<Pick<PlanChoices, 'mode' | 'prepDay'>>,
  weekStart: string,
  today: string,
): PlanSlotRef[] {
  const slots: PlanSlotRef[] = [];
  // Cook once: the meals are eaten from the prep, so they start on the prep day itself.
  const cooked = choices.mode === 'once' ? prepDateFor(weekStart, prepWeekday(choices)) : null;
  for (const day of planWeek(weekStart)) {
    if (day.key < today || !choices.weekdays.includes(day.weekday)) continue;
    if (cooked !== null && day.key < cooked) continue;
    for (const { value } of PLAN_SLOTS)
      if (choices.meals.includes(value)) slots.push({ day: day.key, slot: value });
  }
  return slots;
}

type RequestInput = {
  choices: PlanChoices;
  /** The meals still to plan. */
  slots: readonly PlanSlotRef[];
  /** Titles of the locked dishes, kept and planned around. */
  keep: readonly string[];
  serves: number;
  conditions: readonly ConditionKey[];
};

/**
 * What to send to plan a week: the set-up choices, the condition, and food names only. The lists come from the phone's
 * own (see `foodLists`). Never symptoms, notes, photos or the person's name. Empty lists are left out.
 */
export function buildPlanRequest(db: AppDb, input: RequestInput): MealPlanRequest {
  const { choices } = input;
  const request: MealPlanRequest = {
    mode: choices.mode,
    slots: input.slots.map((slot) => ({ ...slot })),
    cuisines: [...choices.cuisines],
    serves: input.serves,
  };
  if (choices.mode === 'once') request.prepMinutes = choices.prepMinutes;
  const conditions = sendableConditions(input.conditions);
  if (conditions.length > 0) request.conditions = conditions;
  const keep = requestNames(input.keep, 21);
  if (keep.length > 0) request.keep = keep;
  const lists = foodLists(db, { useFridge: choices.useFridge });
  for (const [key, list] of Object.entries(lists) as [keyof typeof lists, string[]][]) {
    if (list.length > 0) request[key] = list;
  }
  return request;
}

/** "5 meals, 3 dishes to prep": what the plan asks of the week. Skipped meals (eating out) do not count. */
export function planSummary(meals: readonly { dishId: string; skipped: boolean }[], mode: PlanMode): string {
  const eaten = meals.filter((meal) => !meal.skipped);
  const count = `${eaten.length} ${eaten.length === 1 ? 'meal' : 'meals'}`;
  if (mode === 'daily') return count;
  const dishes = new Set(eaten.map((meal) => meal.dishId)).size;
  return `${count}, ${dishes} ${dishes === 1 ? 'dish' : 'dishes'} to prep`;
}

/**
 * The relay's answer as meals to keep, or null when it does not cover exactly the meals that were asked for (a
 * missing one, an extra one, or two for the same slot). The phone never keeps a plan with a hole in it.
 */
export function mealsFromResult(result: MealPlanResult, slots: readonly PlanSlotRef[]): NewMeal[] | null {
  const dishes = new Map(result.dishes.map((dish) => [dish.id, dish]));
  const asked = new Set(slots.map((slot) => `${slot.day}|${slot.slot}`));
  const seen = new Set<string>();
  const meals: NewMeal[] = [];
  for (const meal of result.meals) {
    const key = `${meal.day}|${meal.slot}`;
    const dish = dishes.get(meal.dish);
    if (!dish || !asked.has(key) || seen.has(key)) return null;
    seen.add(key);
    meals.push({ day: meal.day, slot: meal.slot, dish });
  }
  return seen.size === asked.size ? meals : null;
}
