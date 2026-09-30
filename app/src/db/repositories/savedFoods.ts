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

/** One-tap log: saves the food as a diary meal eaten at `eatenAt` (default now), reusing its stored verdict and photo (no relay call). */
export function logSavedFood(db: AppDb, id: number, eatenAt: string = nowIso()): number {
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
      loggedAt: eatenAt,
      tz: currentTimeZone(),
    })
    .returning({ id: foodLogs.id })
    .get().id;
}
