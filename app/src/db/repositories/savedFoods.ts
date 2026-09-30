import { asc, eq, sql } from 'drizzle-orm';

import { currentTimeZone, nowIso } from '@/lib/time';
import type { AnalysisMeta, MealAnalysis } from '@/types/analysis';

import { foodLogs, type SavedFood, savedFoods } from '../schema';
import type { AppDb } from '../types';

export const MAX_SAVED_FOOD_NAME = 60;

/** `analysis`, `analysisMeta` and `overallVerdict` are null for a food added by name only. */
export type StoredSavedFood = Omit<SavedFood, 'analysis' | 'analysisMeta'> & {
  analysis: MealAnalysis | null;
  analysisMeta: AnalysisMeta | null;
};

const toStored = (row: SavedFood) => row as StoredSavedFood;

/** "My foods", A to Z. */
export function listSavedFoods(db: AppDb): StoredSavedFood[] {
  return db
    .select()
    .from(savedFoods)
    .orderBy(asc(sql`lower(${savedFoods.mealName})`), asc(savedFoods.id))
    .all()
    .map(toStored);
}

/** Adds a food by name only. It has no verdict; logging it saves a meal without one. */
export function createSavedFood(db: AppDb, name: string): number {
  const mealName = name.trim().slice(0, MAX_SAVED_FOOD_NAME);
  if (!mealName) throw new Error('A saved food needs a name');
  return db
    .insert(savedFoods)
    .values({ source: 'text', inputText: mealName, mealName })
    .returning({ id: savedFoods.id })
    .get().id;
}

/**
 * Saves a copy of a logged meal to "My foods", keeping its verdict and photo. Saving a meal whose name
 * is already saved changes nothing and returns the existing id, so a second tap can't add a duplicate.
 */
export function saveFoodFromLog(db: AppDb, foodLogId: number): { id: number; created: boolean } {
  const log = db.select().from(foodLogs).where(eq(foodLogs.id, foodLogId)).get();
  if (!log) throw new Error(`Food log ${foodLogId} not found`);
  const existing = db
    .select({ id: savedFoods.id })
    .from(savedFoods)
    .where(sql`lower(${savedFoods.mealName}) = lower(${log.mealName})`)
    .get();
  if (existing) return { id: existing.id, created: false };
  const id = db
    .insert(savedFoods)
    .values({
      source: log.source,
      inputText: log.inputText,
      photoUri: log.photoUri,
      mealName: log.mealName,
      overallVerdict: log.overallVerdict,
      analysis: log.analysis,
      analysisMeta: log.analysisMeta,
    })
    .returning({ id: savedFoods.id })
    .get().id;
  return { id, created: true };
}

/** Renames a saved food. Only the label changes; a stored verdict still describes the original meal. */
export function renameSavedFood(db: AppDb, id: number, name: string): void {
  const mealName = name.trim().slice(0, MAX_SAVED_FOOD_NAME);
  if (!mealName) throw new Error('A saved food needs a name');
  const updated = db
    .update(savedFoods)
    .set({ mealName, updatedAt: nowIso() })
    .where(eq(savedFoods.id, id))
    .returning({ id: savedFoods.id })
    .all();
  if (updated.length === 0) throw new Error(`Saved food ${id} not found`);
}

/** Removes a food from "My foods". Meals already logged from it stay in History. */
export function removeSavedFood(db: AppDb, id: number): void {
  db.delete(savedFoods).where(eq(savedFoods.id, id)).run();
}

/** One-tap log: saves the food as a diary meal eaten now, reusing its stored verdict and photo (no relay call). */
export function logSavedFood(db: AppDb, id: number): number {
  const saved = db.select().from(savedFoods).where(eq(savedFoods.id, id)).get();
  if (!saved) throw new Error(`Saved food ${id} not found`);
  return db
    .insert(foodLogs)
    .values({
      entryType: 'diary',
      source: saved.source,
      inputText: saved.inputText,
      photoUri: saved.photoUri,
      mealName: saved.mealName,
      overallVerdict: saved.overallVerdict,
      analysis: saved.analysis,
      analysisMeta: saved.analysisMeta,
      loggedAt: nowIso(),
      tz: currentTimeZone(),
    })
    .returning({ id: foodLogs.id })
    .get().id;
}

/** One saved food, or null if it was removed. */
export function getSavedFood(db: AppDb, id: number): StoredSavedFood | null {
  const row = db.select().from(savedFoods).where(eq(savedFoods.id, id)).get();
  return row ? toStored(row) : null;
}

export type CheckedFoodInput = {
  /** The saved food being re-checked; it keeps its name. Omitted to add a new food. */
  id?: number;
  source: 'photo' | 'text';
  inputText?: string | null;
  photoUri?: string | null;
  analysis: MealAnalysis;
  meta: AnalysisMeta;
};

/**
 * Saves a verdict to "My foods" without logging a meal. A new food is named by the analysis; if that
 * name is already saved, that food takes the new verdict instead of being duplicated. A text check
 * keeps the food's existing photo.
 */
export function saveCheckedFood(
  db: AppDb,
  input: CheckedFoodInput,
): { id: number; created: boolean; mealName: string } {
  if (!input.analysis.isFood) throw new Error('Only food analyses can be saved');
  const mealName = input.analysis.mealName.trim().slice(0, MAX_SAVED_FOOD_NAME) || 'Meal';
  const existing =
    input.id !== undefined
      ? db.select().from(savedFoods).where(eq(savedFoods.id, input.id)).get()
      : db
          .select()
          .from(savedFoods)
          .where(sql`lower(${savedFoods.mealName}) = lower(${mealName})`)
          .get();
  if (input.id !== undefined && !existing) throw new Error(`Saved food ${input.id} not found`);
  const values = {
    source: input.source,
    inputText: input.inputText?.trim() || null,
    photoUri: input.photoUri ?? existing?.photoUri ?? null,
    overallVerdict: input.analysis.overall.verdict,
    analysis: input.analysis,
    analysisMeta: input.meta,
  };
  if (existing) {
    db.update(savedFoods)
      .set({ ...values, updatedAt: nowIso() })
      .where(eq(savedFoods.id, existing.id))
      .run();
    return { id: existing.id, created: false, mealName: existing.mealName };
  }
  const id = db
    .insert(savedFoods)
    .values({ ...values, mealName })
    .returning({ id: savedFoods.id })
    .get().id;
  return { id, created: true, mealName };
}
