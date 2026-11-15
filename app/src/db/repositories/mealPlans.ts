import { asc, desc, eq } from 'drizzle-orm';

import {
  isPlanChoices,
  isPlanMode,
  isPlanSlot,
  type PlanChoices,
  type PlanMode,
  type PlanSlot,
} from '@/constants/mealPlan';
import { isPlanDish, pickPlanDish } from '@/lib/planDish';
import { nowIso } from '@/lib/time';
import type { PlanDish } from '@/types/mealPlan';

import { mealPlans, type PlannedMeal, plannedMeals } from '../schema';
import type { AppDb } from '../types';

/** A meal of the plan with its dish parsed. */
export type StoredMeal = {
  id: number;
  day: string;
  slot: PlanSlot;
  dishId: string;
  dish: PlanDish;
  locked: boolean;
  skipped: boolean;
  /** When "Log it" was tapped for this meal, or null. */
  loggedAt: string | null;
};

export type StoredPlan = {
  id: number;
  weekStart: string;
  mode: PlanMode;
  choices: PlanChoices;
  /** In the order they are eaten: by day, then breakfast, lunch, dinner. */
  meals: StoredMeal[];
};

/** A meal to add to a plan. */
export type NewMeal = { day: string; slot: PlanSlot; dish: PlanDish };

const SLOT_ORDER: Record<PlanSlot, number> = { breakfast: 0, lunch: 1, dinner: 2 };

/** A row whose stored dish no longer has the right shape is skipped, not crashed on. */
function toMeal(row: PlannedMeal): StoredMeal | null {
  if (!isPlanDish(row.recipe) || !isPlanSlot(row.slot)) return null;
  return {
    id: row.id,
    day: row.day,
    slot: row.slot,
    dishId: row.dishId,
    dish: row.recipe,
    locked: row.locked,
    skipped: row.skipped,
    loggedAt: row.loggedAt,
  };
}

function mealsOf(db: AppDb, planId: number): StoredMeal[] {
  return db
    .select()
    .from(plannedMeals)
    .where(eq(plannedMeals.planId, planId))
    .orderBy(asc(plannedMeals.day), asc(plannedMeals.id))
    .all()
    .map(toMeal)
    .filter((meal): meal is StoredMeal => meal !== null)
    .sort((a, b) => (a.day === b.day ? SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot] : a.day < b.day ? -1 : 1));
}

/** The newest plan, or null when there is none (or the newest cannot be read). */
export function getCurrentPlan(db: AppDb): StoredPlan | null {
  const row = db.select().from(mealPlans).orderBy(desc(mealPlans.createdAt), desc(mealPlans.id)).get();
  return row ? getPlanById(db, row.id) : null;
}

function insertMeals(db: AppDb, planId: number, meals: readonly NewMeal[]): void {
  for (const meal of meals) {
    db.insert(plannedMeals)
      .values({
        planId,
        day: meal.day,
        slot: meal.slot,
        dishId: meal.dish.id,
        recipe: pickPlanDish(meal.dish),
      })
      .run();
  }
}

/** Saves a new plan and makes it the current one. The older plans go: only the newest is ever shown. */
export function createPlan(
  db: AppDb,
  input: { weekStart: string; choices: PlanChoices; meals: readonly NewMeal[] },
): StoredPlan {
  const id = db.transaction((tx) => {
    tx.delete(plannedMeals).run();
    tx.delete(mealPlans).run();
    const row = tx
      .insert(mealPlans)
      .values({ weekStart: input.weekStart, mode: input.choices.mode, choices: input.choices })
      .returning()
      .get();
    insertMeals(tx as unknown as AppDb, row.id, input.meals);
    return row.id;
  });
  return getPlanById(db, id) as StoredPlan;
}

function getPlanById(db: AppDb, id: number): StoredPlan | null {
  const row = db.select().from(mealPlans).where(eq(mealPlans.id, id)).get();
  if (!row || !isPlanMode(row.mode) || !isPlanChoices(row.choices)) return null;
  return {
    id: row.id,
    weekStart: row.weekStart,
    mode: row.mode,
    choices: row.choices,
    meals: mealsOf(db, row.id),
  };
}

/** Eating out that meal: it stays in the plan, skipped, and is left out of the prep day and the shopping list. */
export function setMealSkipped(db: AppDb, mealId: number, skipped: boolean): void {
  db.update(plannedMeals).set({ skipped, updatedAt: nowIso() }).where(eq(plannedMeals.id, mealId)).run();
}

/**
 * "Log it" was tapped for this meal. Only a note of when: a meal logged after it counts as this one, and nothing is
 * logged here (a plan is never a log).
 */
export function markMealLogOffered(db: AppDb, mealId: number, at: string): void {
  db.update(plannedMeals).set({ loggedAt: at, updatedAt: nowIso() }).where(eq(plannedMeals.id, mealId)).run();
}

/** Swapping a meal for another dish. */
export function swapMeal(db: AppDb, mealId: number, dish: PlanDish): void {
  db.update(plannedMeals)
    .set({ dishId: dish.id, recipe: pickPlanDish(dish), skipped: false, loggedAt: null, updatedAt: nowIso() })
    .where(eq(plannedMeals.id, mealId))
    .run();
}

export function getMeal(db: AppDb, mealId: number): StoredMeal | null {
  const row = db.select().from(plannedMeals).where(eq(plannedMeals.id, mealId)).get();
  return row ? toMeal(row) : null;
}

/** Deletes a plan and its meals ("Start over"). */
export function deletePlan(db: AppDb, planId: number): void {
  db.delete(plannedMeals).where(eq(plannedMeals.planId, planId)).run();
  db.delete(mealPlans).where(eq(mealPlans.id, planId)).run();
}
