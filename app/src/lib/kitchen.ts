import { and, desc, eq } from 'drizzle-orm';

import type { ConditionKey } from '@/constants/conditions';
import type { CuisineKey, RecipeTime } from '@/constants/cuisines';
import { listAvoidFoods } from '@/db/repositories/avoidFoods';
import { listSavedFoods } from '@/db/repositories/savedFoods';
import { foodLogs } from '@/db/schema';
import type { AppDb } from '@/db/types';
import { currentTimeZone } from '@/lib/time';
import type { AdjustRequest, Recipe, RecipeChange, RecipeRequest } from '@/types/recipe';

import { localDayKey } from './localDay';
import { cleanFoodName } from './recipe';

/** Rounds of ideas (three each) per day. The relay allows a few more, so a "Try again" after a failure still works. */
export const KITCHEN_DAILY_ROUNDS = 10;

/** The relay's caps on the lists in one request (its `recipeIdeasBodySchema`). */
const MAX_FAVORITES = 15;
const MAX_TRIGGERS = 20;
const MAX_AVOID = 30;
const MAX_SHOWN = 12;

export type KitchenRounds = { day: string; count: number };

/** Today as a local "YYYY-MM-DD". */
export function todayKey(now: Date = new Date()): string {
  return localDayKey(now.toISOString(), currentTimeZone());
}

/** Rounds made today: a count kept for an earlier day is a new day, so none. */
export function roundsToday(rounds: KitchenRounds, day: string): number {
  return rounds.day === day ? rounds.count : 0;
}

export function roundsLeft(rounds: KitchenRounds, day: string): number {
  return Math.max(0, KITCHEN_DAILY_ROUNDS - roundsToday(rounds, day));
}

/** The count after one more round today. */
export function countRound(rounds: KitchenRounds, day: string): KitchenRounds {
  return { day, count: roundsToday(rounds, day) + 1 };
}

/** Clean, de-duplicated (ignoring capitals), non-empty names, at most `max` of them. */
function uniqueNames(names: readonly string[], max: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const clean = cleanFoodName(name);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= max) break;
  }
  return result;
}

/** Meals logged as a trigger, newest first: the foods that bothered the person before. */
function triggerFoodNames(db: AppDb): string[] {
  const rows = db
    .select({ name: foodLogs.mealName })
    .from(foodLogs)
    .where(and(eq(foodLogs.entryType, 'diary'), eq(foodLogs.overallVerdict, 'trigger')))
    .orderBy(desc(foodLogs.loggedAt))
    .limit(100)
    .all();
  const saved = listSavedFoods(db)
    .filter((food) => food.overallVerdict === 'trigger')
    .map((food) => food.mealName);
  return uniqueNames([...rows.map((row) => row.name), ...saved], MAX_TRIGGERS);
}

type Choices = {
  cuisine: CuisineKey;
  time: RecipeTime;
  serves: number;
  /** Ingredients typed on the sheet. */
  want: readonly string[];
  conditions: readonly ConditionKey[];
  /** Dishes already shown this round, so more ideas are new ones. */
  shown?: readonly string[];
};

/**
 * What to send for a round of ideas: the sheet's choices, the condition, and food names only. The favorites,
 * the foods that were logged as a trigger and the "I don't eat" list come from the phone's own lists. Never
 * symptoms, notes, photos or the person's name. Empty lists are left out.
 */
export function buildRecipeRequest(db: AppDb, choices: Choices): RecipeRequest {
  const request: RecipeRequest = { cuisine: choices.cuisine, time: choices.time, serves: choices.serves };
  const conditions = choices.conditions.filter(
    (key): key is Exclude<ConditionKey, 'unsure'> => key !== 'unsure',
  );
  if (conditions.length > 0) request.conditions = conditions;

  const lists = {
    want: uniqueNames(choices.want, 10),
    favorites: uniqueNames(
      listSavedFoods(db).map((food) => food.mealName),
      MAX_FAVORITES,
    ),
    triggers: triggerFoodNames(db),
    avoid: uniqueNames(
      listAvoidFoods(db).map((food) => food.name),
      MAX_AVOID,
    ),
    shown: uniqueNames(choices.shown ?? [], MAX_SHOWN),
  };
  for (const [key, list] of Object.entries(lists) as [keyof typeof lists, string[]][]) {
    if (list.length > 0) request[key] = list;
  }
  return request;
}

/** How many ingredient edits one recipe keeps for Undo. */
export const MAX_UNDO = 5;

/**
 * What to send to change one recipe: the recipe (without the phone's own picture), the change, the condition, and the
 * foods that bothered the person or that they never eat. Never symptoms, notes, photos or the person's name.
 */
export function buildAdjustRequest(
  db: AppDb,
  input: { recipe: Recipe; change: RecipeChange; conditions: readonly ConditionKey[] },
): AdjustRequest {
  const { look: _look, ...recipe } = input.recipe;
  const request: AdjustRequest = { recipe, change: input.change };
  const conditions = input.conditions.filter(
    (key): key is Exclude<ConditionKey, 'unsure'> => key !== 'unsure',
  );
  if (conditions.length > 0) request.conditions = conditions;
  const triggers = triggerFoodNames(db);
  if (triggers.length > 0) request.triggers = triggers;
  const avoid = uniqueNames(
    listAvoidFoods(db).map((food) => food.name),
    MAX_AVOID,
  );
  if (avoid.length > 0) request.avoid = avoid;
  return request;
}

/** The earlier versions to keep for Undo: the newest last, at most five. */
export const pushUndo = (stack: readonly Recipe[], previous: Recipe): Recipe[] =>
  [...stack, previous].slice(-MAX_UNDO);
