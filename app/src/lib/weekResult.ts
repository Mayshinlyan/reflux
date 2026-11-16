import { listDiaryFoodLogs } from '@/db/repositories/food';
import type { StoredPlan } from '@/db/repositories/mealPlans';
import { listSymptomLogs } from '@/db/repositories/symptoms';
import type { AppDb } from '@/db/types';

import { addDays } from './localDay';
import { weekdayOf } from './mealPlan';
import { weekResult } from './planToday';

/**
 * A plan's week is ending once it is its Saturday or later: that is when the Kitchen offers the next one. The week
 * starts on a Sunday, so its Saturday is the sixth day after it (a Monday start from before, the fifth).
 */
export function weekIsEnding(plan: StoredPlan, today: string): boolean {
  return today >= addDays(plan.weekStart, weekdayOf(plan.weekStart) === 1 ? 5 : 6);
}

/**
 * How a plan's week went, from the diary on the phone: the planned meals that were logged, and the ones that sat well
 * (no symptom within a few hours). Reads only; the diary is never changed.
 */
export function planWeekResult(db: AppDb, plan: StoredPlan): ReturnType<typeof weekResult> {
  const range = {
    from: new Date(`${plan.weekStart}T00:00:00`).toISOString(),
    to: new Date(`${addDays(plan.weekStart, 8)}T00:00:00`).toISOString(),
  };
  return weekResult(plan.meals, listDiaryFoodLogs(db, range), listSymptomLogs(db, range));
}
