import { asc, eq, sql } from 'drizzle-orm';

import { withIngredients } from '@/lib/ingredients';
import { effectiveVerdict, withUserVerdict } from '@/lib/verdict';
import { currentTimeZone, nowIso } from '@/lib/time';
import type { AnalysisMeta, AppVerdict, MealAnalysis } from '@/types/analysis';

import { foodLogs, type SavedFood, savedFoods } from '../schema';
import type { AppDb } from '../types';

export const MAX_SAVED_FOOD_NAME = 60;

let onChange: (() => void) | null = null;

/** Called after "My foods" changes (added, renamed, edited, removed, or wiped), so the home-screen widget can follow. */
export function onSavedFoodsChange(listener: (() => void) | null): void {
  onChange = listener;
}

/** Tells the listener, if any, that the list changed. A failing listener never breaks the save. */
export function notifySavedFoodsChanged(): void {
  try {
    onChange?.();
  } catch {
    // The widget is a nicety; the change itself is already saved.
  }
}

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
  const id = db
    .insert(savedFoods)
    .values({ source: 'text', inputText: mealName, mealName })
    .returning({ id: savedFoods.id })
    .get().id;
  notifySavedFoodsChanged();
  return id;
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
  notifySavedFoodsChanged();
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
  notifySavedFoodsChanged();
}

export type SavedFoodEdit = {
  name: string;
  /** A new photo (already in permanent storage), or omitted to keep the current one. */
  photoUri?: string;
  /** The edited ingredient names, applied to the stored verdict; ignored when `check` is given. */
  ingredients?: string[];
  /** A verdict from checking the edited food again, replacing the stored one (and any verdict set by hand). */
  check?: { analysis: MealAnalysis; meta: AnalysisMeta };
  /** The verdict the user chose, applied over the AI's; the AI's own verdict clears it. Needs a stored verdict. */
  verdict?: AppVerdict;
};

/**
 * Saves edits to a saved food from its edit sheet. A new check replaces the verdict; edited ingredients
 * alone change the stored list but leave the verdict as it was, until the food is checked again. A verdict
 * chosen by hand sits on top of the AI's, and `overallVerdict` always holds the one that applies.
 */
export function updateSavedFood(db: AppDb, id: number, edit: SavedFoodEdit): void {
  const mealName = edit.name.trim().slice(0, MAX_SAVED_FOOD_NAME);
  if (!mealName) throw new Error('A saved food needs a name');
  const existing = db.select().from(savedFoods).where(eq(savedFoods.id, id)).get();
  if (!existing) throw new Error(`Saved food ${id} not found`);
  const values: Partial<SavedFood> = { mealName, updatedAt: nowIso() };
  if (edit.photoUri !== undefined) values.photoUri = edit.photoUri;
  let analysis = existing.analysis as MealAnalysis | null;
  if (edit.check) {
    analysis = edit.check.analysis;
    values.analysisMeta = edit.check.meta;
  } else if (edit.ingredients && analysis) {
    analysis = withIngredients(analysis, edit.ingredients);
  }
  if (edit.verdict !== undefined && analysis) analysis = withUserVerdict(analysis, edit.verdict);
  if (analysis !== existing.analysis) {
    values.analysis = analysis;
    if (analysis) values.overallVerdict = effectiveVerdict(analysis);
  }
  db.update(savedFoods).set(values).where(eq(savedFoods.id, id)).run();
  notifySavedFoodsChanged();
}

/** Removes a food from "My foods". Meals already logged from it stay in History. */
export function removeSavedFood(db: AppDb, id: number): void {
  db.delete(savedFoods).where(eq(savedFoods.id, id)).run();
  notifySavedFoodsChanged();
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
    notifySavedFoodsChanged();
    return { id: existing.id, created: false, mealName: existing.mealName };
  }
  const id = db
    .insert(savedFoods)
    .values({ ...values, mealName })
    .returning({ id: savedFoods.id })
    .get().id;
  notifySavedFoodsChanged();
  return { id, created: true, mealName };
}

/** Whether a meal of this name is already in "My foods" (the same match `saveFoodFromLog` uses). */
export function isFoodSaved(db: AppDb, mealName: string): boolean {
  return (
    db
      .select({ id: savedFoods.id })
      .from(savedFoods)
      .where(sql`lower(${savedFoods.mealName}) = lower(${mealName})`)
      .get() !== undefined
  );
}
