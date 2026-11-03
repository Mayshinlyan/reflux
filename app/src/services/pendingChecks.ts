import { analysisConditions } from '@/constants/conditions';
import {
  isPendingCheck,
  listPendingChecks,
  type StoredFoodLog,
  setMealAnalysis,
} from '@/db/repositories/food';
import { getSetting } from '@/db/repositories/settings';
import type { AppDb } from '@/db/types';
import { notifyEntriesChanged } from '@/lib/entriesChanged';
import { AppError, type ErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';

import { photoUri } from './photoStore';
import { analyzeFood } from './relayClient';

/** Reasons a later try can still work (no signal, a slow relay). Anything else won't change by asking again. */
const RETRYABLE: readonly ErrorCode[] = ['OFFLINE', 'NETWORK', 'AI_TIMEOUT'];

/** Meals not to ask about again in this session: the relay said it isn't food, or the answer couldn't be kept. */
const settled = new Set<number>();
let running = false;
/** A call that came in during a run: the list that run started from can't include that meal, so go round again. */
let again = false;

/** A meal logged with "Just log it" whose verdict is still on its way: the row shows "Checking…" for it. */
export function isChecking(log: StoredFoodLog, now: Date = new Date()): boolean {
  return isPendingCheck(log, now) && !settled.has(log.id);
}

const inputFor = (meal: StoredFoodLog) =>
  meal.inputText
    ? { text: meal.inputText }
    : meal.photoUri
      ? { photo: { uri: photoUri(meal.photoUri), mimeType: 'image/jpeg' } }
      : null;

/**
 * "Just log it" saves the meal first and checks it afterwards: this finds the diary meals still waiting for a
 * verdict and asks the relay about each, one at a time, so a meal logged without a signal gets its verdict later.
 * Today and History reload as each one lands, or when one is given up on. Call it after logging and whenever the
 * app comes to the front; a call while one is already running makes that run go round once more. It never throws.
 */
export async function checkPendingMeals(db: AppDb): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    do {
      again = false;
      await checkOnce(db);
    } while (again);
  } catch (error) {
    logger.error('checkPendingMeals', error);
  } finally {
    running = false;
  }
}

async function checkOnce(db: AppDb): Promise<void> {
  const conditions = analysisConditions(getSetting(db, 'conditions'));
  // The newest few: older ones wait for a later run, which is fine for something that finishes in the background.
  for (const meal of listPendingChecks(db)) {
    if (settled.has(meal.id)) continue;
    const input = inputFor(meal);
    if (!input) {
      settle(meal.id);
      continue;
    }
    try {
      const { meta, ...analysis } = await analyzeFood({ ...input, ...conditions });
      if (!analysis.isFood) {
        settle(meal.id);
        continue;
      }
      settled.add(meal.id);
      if (setMealAnalysis(db, meal.id, { analysis, meta })) notifyEntriesChanged();
    } catch (caught) {
      const error = caught instanceof AppError ? caught : new AppError('INTERNAL');
      // Operation and code only: never the food or the analysis.
      logger.error('checkPendingMeal', error);
      if (!RETRYABLE.includes(error.code)) settle(meal.id);
      // No signal now means none for the rest either; the next foreground tries again.
      if (error.code === 'OFFLINE') return;
    }
  }
}

/** Gives up on a meal for this session, and tells the rows so "Checking…" goes away. */
function settle(id: number): void {
  settled.add(id);
  notifyEntriesChanged();
}

/** For tests: forget which meals were settled. */
export function resetPendingChecks(): void {
  settled.clear();
  running = false;
  again = false;
}
