import { and, asc, eq, gte, lt } from 'drizzle-orm';

import { currentTimeZone, nowIso } from '@/lib/time';
import type { AnalysisMeta, MealAnalysis } from '@/types/analysis';

import { type FoodLog, foodLogs } from '../schema';
import type { AppDb } from '../types';

export type FoodLogInput = {
  entryType: 'diary' | 'check';
  source: 'photo' | 'text';
  inputText?: string | null;
  photoUri?: string | null;
  analysis: MealAnalysis;
  meta: AnalysisMeta;
  loggedAt?: string;
  tz?: string;
};

/** `analysis`, `analysisMeta` and `overallVerdict` are null for a meal saved without a check. */
export type StoredFoodLog = Omit<FoodLog, 'analysis' | 'analysisMeta'> & {
  analysis: MealAnalysis | null;
  analysisMeta: AnalysisMeta | null;
};

const toStored = (row: FoodLog) => row as StoredFoodLog;

export function createFoodLog(db: AppDb, input: FoodLogInput): number {
  if (!input.analysis.isFood) throw new Error('Only food analyses can be saved');
  return db
    .insert(foodLogs)
    .values({
      entryType: input.entryType,
      source: input.source,
      inputText: input.inputText?.trim() || null,
      photoUri: input.photoUri ?? null,
      mealName: input.analysis.mealName,
      overallVerdict: input.analysis.overall.verdict,
      analysis: input.analysis,
      analysisMeta: input.meta,
      loggedAt: input.loggedAt ?? nowIso(),
      tz: input.tz ?? currentTimeZone(),
    })
    .returning({ id: foodLogs.id })
    .get().id;
}

export type UncheckedMealInput = {
  source: 'photo' | 'text';
  /** What the user typed. For a photo it is empty and the meal is named "Meal". */
  inputText?: string | null;
  photoUri?: string | null;
  loggedAt?: string;
  tz?: string;
};

/**
 * A diary meal saved without a verdict, for when the food can't be checked (e.g. offline) or the
 * user just wants it noted. It has no analysis, and the pet ignores it.
 */
export function createUncheckedMeal(db: AppDb, input: UncheckedMealInput): number {
  const text = input.inputText?.trim() || null;
  return db
    .insert(foodLogs)
    .values({
      entryType: 'diary',
      source: input.source,
      inputText: text,
      photoUri: input.photoUri ?? null,
      mealName: text ?? 'Meal',
      overallVerdict: null,
      analysis: null,
      analysisMeta: null,
      loggedAt: input.loggedAt ?? nowIso(),
      tz: input.tz ?? currentTimeZone(),
    })
    .returning({ id: foodLogs.id })
    .get().id;
}

export function getFoodLog(db: AppDb, id: number): StoredFoodLog | undefined {
  const row = db.select().from(foodLogs).where(eq(foodLogs.id, id)).get();
  return row ? toStored(row) : undefined;
}

/** Diary meals with `from <= logged_at < to`, oldest first. Checks are not part of the diary. */
export function listDiaryFoodLogs(db: AppDb, range: { from: string; to: string }): StoredFoodLog[] {
  return db
    .select()
    .from(foodLogs)
    .where(
      and(
        eq(foodLogs.entryType, 'diary'),
        gte(foodLogs.loggedAt, range.from),
        lt(foodLogs.loggedAt, range.to),
      ),
    )
    .orderBy(asc(foodLogs.loggedAt), asc(foodLogs.id))
    .all()
    .map(toStored);
}

/** Replaces a check's analysis after the user updated its verdict with a comment. Diary meals are left alone. */
export function updateFoodCheck(
  db: AppDb,
  id: number,
  { analysis, meta }: { analysis: MealAnalysis; meta: AnalysisMeta },
): void {
  if (!analysis.isFood) throw new Error('Only food analyses can be saved');
  const updated = db
    .update(foodLogs)
    .set({
      mealName: analysis.mealName,
      overallVerdict: analysis.overall.verdict,
      analysis,
      analysisMeta: meta,
      updatedAt: nowIso(),
    })
    .where(and(eq(foodLogs.id, id), eq(foodLogs.entryType, 'check')))
    .returning({ id: foodLogs.id })
    .all();
  if (updated.length === 0) throw new Error(`Food check ${id} not found`);
}

/**
 * "I ate this": moves a food check into the diary, reusing its stored analysis so the
 * relay is never called twice for the same meal.
 */
export function promoteCheckToDiary(db: AppDb, id: number, eatenAt: string = nowIso()): void {
  const updated = db
    .update(foodLogs)
    .set({ entryType: 'diary', loggedAt: eatenAt, tz: currentTimeZone(), updatedAt: nowIso() })
    .where(and(eq(foodLogs.id, id), eq(foodLogs.entryType, 'check')))
    .returning({ id: foodLogs.id })
    .all();
  if (updated.length === 0) throw new Error(`Food check ${id} not found`);
}

/**
 * "Log again": saves a copy of a meal as a new diary entry eaten now. It reuses the stored analysis
 * (and photo file) so the relay is never called, which means the verdict is the one from the first time.
 */
export function relogFood(db: AppDb, id: number): number {
  const source = getFoodLog(db, id);
  if (!source) throw new Error(`Food log ${id} not found`);
  return db
    .insert(foodLogs)
    .values({
      entryType: 'diary',
      source: source.source,
      inputText: source.inputText,
      photoUri: source.photoUri,
      mealName: source.mealName,
      overallVerdict: source.overallVerdict,
      analysis: source.analysis,
      analysisMeta: source.analysisMeta,
      loggedAt: nowIso(),
      tz: currentTimeZone(),
    })
    .returning({ id: foodLogs.id })
    .get().id;
}

export function deleteFoodLog(db: AppDb, id: number): void {
  db.delete(foodLogs).where(eq(foodLogs.id, id)).run();
}
