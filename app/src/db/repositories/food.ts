import { and, asc, count, desc, eq, gte, inArray, isNull, lt, max, ne, sql } from 'drizzle-orm';

import { isCustomTag, LIFESTYLE_TAG_KEYS, type LoggedTagKey } from '@/constants/lifestyleTags';
import { cleanCustomSymptom, customSymptomLabel } from '@/constants/symptomItems';
import { currentTimeZone, nowIso } from '@/lib/time';
import { effectiveVerdict, withUserVerdict } from '@/lib/verdict';
import type { AnalysisMeta, AppVerdict, MealAnalysis, Portion } from '@/types/analysis';

import { type FoodLog, foodLogs, foodLogTags } from '../schema';
import type { AppDb } from '../types';

export type FoodLogInput = {
  entryType: 'diary' | 'check';
  source: 'photo' | 'text';
  inputText?: string | null;
  photoUri?: string | null;
  analysis: MealAnalysis;
  meta: AnalysisMeta;
  /** As sent with the check; a regular portion is stored as null. */
  portion?: Portion;
  loggedAt?: string;
  tz?: string;
};

/** `analysis`, `analysisMeta` and `overallVerdict` are null for a meal saved without a check. */
export type StoredFoodLog = Omit<FoodLog, 'analysis' | 'analysisMeta'> & {
  analysis: MealAnalysis | null;
  analysisMeta: AnalysisMeta | null;
};

const toStored = (row: FoodLog) => row as StoredFoodLog;

const storedPortion = (portion?: Portion) => (portion && portion !== 'regular' ? portion : null);

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
      portion: storedPortion(input.portion),
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
  portion?: Portion;
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
      portion: storedPortion(input.portion),
      loggedAt: input.loggedAt ?? nowIso(),
      tz: input.tz ?? currentTimeZone(),
    })
    .returning({ id: foodLogs.id })
    .get().id;
}

/** How long a meal saved without a verdict waits to be checked, from when it was logged. */
export const PENDING_CHECK_HOURS = 48;

/** True for a diary meal that is still waiting for its verdict: saved without one, and not too long ago. */
export function isPendingCheck(log: StoredFoodLog, now: Date = new Date()): boolean {
  return (
    log.entryType === 'diary' &&
    log.analysis === null &&
    Date.parse(log.createdAt) >= now.getTime() - PENDING_CHECK_HOURS * 3_600_000
  );
}

/** Diary meals still waiting for a verdict (see `isPendingCheck`), newest first. */
export function listPendingChecks(db: AppDb, now: Date = new Date(), limit = 10): StoredFoodLog[] {
  const since = new Date(now.getTime() - PENDING_CHECK_HOURS * 3_600_000).toISOString();
  return db
    .select()
    .from(foodLogs)
    .where(and(eq(foodLogs.entryType, 'diary'), isNull(foodLogs.analysis), gte(foodLogs.createdAt, since)))
    .orderBy(desc(foodLogs.id))
    .limit(limit)
    .all()
    .map(toStored);
}

/**
 * Attaches a verdict to a diary meal that was saved without one ("Just log it"). A meal that already has one is
 * left alone (returns false). A photo meal, which was named "Meal", takes the name the check found; a typed
 * name stays as the user wrote it.
 */
export function setMealAnalysis(
  db: AppDb,
  id: number,
  { analysis, meta }: { analysis: MealAnalysis; meta: AnalysisMeta },
): boolean {
  if (!analysis.isFood) throw new Error('Only food analyses can be saved');
  const existing = getFoodLog(db, id);
  if (!existing || existing.entryType !== 'diary' || existing.analysis !== null) return false;
  db.update(foodLogs)
    .set({
      ...(existing.inputText ? {} : { mealName: analysis.mealName }),
      overallVerdict: analysis.overall.verdict,
      analysis,
      analysisMeta: meta,
      updatedAt: nowIso(),
    })
    .where(and(eq(foodLogs.id, id), isNull(foodLogs.analysis)))
    .run();
  return true;
}

/**
 * Names of past diary meals for the suggestions while typing: each name once (ignoring case), the one eaten most
 * recently first. Meals saved without a name ("Meal", from a photo) and checks are left out.
 */
export function listRecentMealNames(db: AppDb, limit = 200): string[] {
  return db
    .select({ name: foodLogs.mealName })
    .from(foodLogs)
    .where(and(eq(foodLogs.entryType, 'diary'), ne(foodLogs.mealName, 'Meal')))
    .groupBy(sql`lower(${foodLogs.mealName})`)
    .orderBy(desc(max(foodLogs.loggedAt)), desc(foodLogs.id))
    .limit(limit)
    .all()
    .map((row) => row.name);
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

/** How many meals are in the diary, ever. Checks are not part of it. */
export function countDiaryMeals(db: AppDb): number {
  return db.select({ n: count() }).from(foodLogs).where(eq(foodLogs.entryType, 'diary')).get()?.n ?? 0;
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

export const MAX_MEAL_NAME = 100;

export type FoodLogEdit = {
  name: string;
  /** When it was eaten; the time zone becomes the current one. Omitted keeps the stored time. */
  loggedAt?: string;
  portion?: Portion;
  /** A verdict from checking the meal again (e.g. for a new portion), replacing the stored one. */
  check?: { analysis: MealAnalysis; meta: AnalysisMeta };
  /** The verdict the user chose, applied over the AI's. Needs a stored verdict. */
  verdict?: AppVerdict;
};

/**
 * Saves edits to a diary meal from History. Like a saved food's edit: a new check replaces the verdict, a
 * verdict chosen by hand sits on top of the AI's, and `overallVerdict` always holds the one that applies.
 */
export function updateFoodLog(db: AppDb, id: number, edit: FoodLogEdit): void {
  const mealName = edit.name.trim().slice(0, MAX_MEAL_NAME);
  if (!mealName) throw new Error('A meal needs a name');
  const existing = getFoodLog(db, id);
  if (!existing || existing.entryType !== 'diary') throw new Error(`Diary meal ${id} not found`);
  const values: Partial<FoodLog> = { mealName, updatedAt: nowIso() };
  if (edit.loggedAt !== undefined) {
    values.loggedAt = edit.loggedAt;
    values.tz = currentTimeZone();
  }
  if (edit.portion !== undefined) values.portion = storedPortion(edit.portion);
  let analysis = existing.analysis;
  if (edit.check) {
    if (!edit.check.analysis.isFood) throw new Error('Only food analyses can be saved');
    analysis = edit.check.analysis;
    values.analysisMeta = edit.check.meta;
  }
  if (edit.verdict !== undefined && analysis) analysis = withUserVerdict(analysis, edit.verdict);
  if (analysis !== existing.analysis) {
    values.analysis = analysis;
    if (analysis) values.overallVerdict = effectiveVerdict(analysis);
  }
  db.update(foodLogs).set(values).where(eq(foodLogs.id, id)).run();
}

const MAX_NOTES_LENGTH = 1000;

export type MealDetails = {
  /** When it was eaten; the time zone becomes the current one. Omitted keeps the stored time. */
  loggedAt?: string;
  portion?: Portion;
  tags?: LoggedTagKey[];
  notes?: string | null;
};

/** Moves a logged meal to another time and leaves everything else on it as it is. */
export function setMealTime(db: AppDb, id: number, loggedAt: string): void {
  const updated = db
    .update(foodLogs)
    .set({ loggedAt, tz: currentTimeZone(), updatedAt: nowIso() })
    .where(eq(foodLogs.id, id))
    .returning({ id: foodLogs.id })
    .all();
  if (updated.length === 0) throw new Error(`Food log ${id} not found`);
}

/**
 * The details step after a verdict: when it was eaten, how much, lifestyle tags and a note. A tag is a
 * built-in factor or one the user typed (`custom:<text>`). Replaces the meal's tags, so an empty list clears
 * them. Works on diary meals and checks alike (a check is promoted separately).
 */
export function saveMealDetails(db: AppDb, id: number, details: MealDetails): void {
  const tags = [...new Set(details.tags ?? [])];
  for (const tag of tags) {
    if (isCustomTag(tag)) {
      // The user's own text, so the message never repeats it.
      const text = customSymptomLabel(tag);
      if (!text || cleanCustomSymptom(text) !== text) throw new Error('Invalid custom tag');
    } else if (!LIFESTYLE_TAG_KEYS.includes(tag)) {
      throw new Error(`Unknown tag: ${tag}`);
    }
  }
  const values: Partial<FoodLog> = {
    notes: details.notes?.trim().slice(0, MAX_NOTES_LENGTH) || null,
    updatedAt: nowIso(),
  };
  if (details.loggedAt !== undefined) {
    values.loggedAt = details.loggedAt;
    values.tz = currentTimeZone();
  }
  if (details.portion !== undefined) values.portion = storedPortion(details.portion);
  db.transaction((tx) => {
    const updated = tx
      .update(foodLogs)
      .set(values)
      .where(eq(foodLogs.id, id))
      .returning({ id: foodLogs.id })
      .all();
    if (updated.length === 0) throw new Error(`Food log ${id} not found`);
    tx.delete(foodLogTags).where(eq(foodLogTags.foodLogId, id)).run();
    if (tags.length > 0) {
      tx.insert(foodLogTags)
        .values(tags.map((tagKey) => ({ foodLogId: id, tagKey })))
        .run();
    }
  });
}

/** The lifestyle tags on a meal. */
export function listMealTags(db: AppDb, id: number): LoggedTagKey[] {
  return db
    .select({ tagKey: foodLogTags.tagKey })
    .from(foodLogTags)
    .where(eq(foodLogTags.foodLogId, id))
    .all()
    .map((row) => row.tagKey as LoggedTagKey);
}

/** The lifestyle tags of several meals at once, by meal id; a meal without tags is absent. */
export function listMealTagsFor(db: AppDb, ids: readonly number[]): Map<number, LoggedTagKey[]> {
  const byMeal = new Map<number, LoggedTagKey[]>();
  // Chunked so a long history stays under SQLite's limit on bound values.
  for (let i = 0; i < ids.length; i += 500) {
    const rows = db
      .select({ foodLogId: foodLogTags.foodLogId, tagKey: foodLogTags.tagKey })
      .from(foodLogTags)
      .where(inArray(foodLogTags.foodLogId, ids.slice(i, i + 500)))
      .all();
    for (const row of rows) {
      byMeal.set(row.foodLogId, [...(byMeal.get(row.foodLogId) ?? []), row.tagKey as LoggedTagKey]);
    }
  }
  return byMeal;
}

export function deleteFoodLog(db: AppDb, id: number): void {
  db.delete(foodLogs).where(eq(foodLogs.id, id)).run();
}
