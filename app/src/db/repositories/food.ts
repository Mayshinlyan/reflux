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

export type StoredFoodLog = Omit<FoodLog, 'analysis' | 'analysisMeta'> & {
  analysis: MealAnalysis;
  analysisMeta: AnalysisMeta;
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

export function deleteFoodLog(db: AppDb, id: number): void {
  db.delete(foodLogs).where(eq(foodLogs.id, id)).run();
}
