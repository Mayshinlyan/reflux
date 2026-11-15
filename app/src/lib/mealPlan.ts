import type { ConditionKey } from '@/constants/conditions';
import { PLAN_SLOTS, type PlanChoices, type PlanMode, type PlanSlot } from '@/constants/mealPlan';
import type { AppDb } from '@/db/types';
import type { NewMeal } from '@/db/repositories/mealPlans';
import type { MealPlanRequest, MealPlanResult } from '@/types/mealPlan';

import { foodLists, requestNames, sendableConditions } from './kitchen';
import { addDays } from './localDay';

export type PlanSlotRef = { day: string; slot: PlanSlot };

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** 0 (Sunday) to 6 (Saturday) for a "YYYY-MM-DD" day key. */
export function weekdayOf(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

/**
 * The Monday a plan starts on: this week's, or next week's when today is a Saturday or Sunday (the weekend is when
 * people plan the week ahead, and a plan for two days would be no plan).
 */
export function planWeekStart(today: string): string {
  const weekday = weekdayOf(today);
  if (weekday === 0) return addDays(today, 1);
  if (weekday === 6) return addDays(today, 2);
  return addDays(today, 1 - weekday);
}

export type PlanDay = { key: string; letter: string; name: string; date: number; weekday: number };

/** The seven days of a plan week, Monday first. */
export function planWeek(weekStart: string): PlanDay[] {
  return LETTERS.map((letter, i) => {
    const key = addDays(weekStart, i);
    return { key, letter, name: NAMES[i] ?? '', date: Number(key.slice(8, 10)), weekday: weekdayOf(key) };
  });
}

/**
 * The meals to plan: every chosen meal on every chosen weekday of the week that has not passed yet, in the order
 * they are eaten.
 */
export function planSlots(
  choices: Pick<PlanChoices, 'weekdays' | 'meals'>,
  weekStart: string,
  today: string,
): PlanSlotRef[] {
  const slots: PlanSlotRef[] = [];
  for (const day of planWeek(weekStart)) {
    if (day.key < today || !choices.weekdays.includes(day.weekday)) continue;
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
