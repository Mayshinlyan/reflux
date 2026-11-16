import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { createPlan, getCurrentPlan, type StoredPlan } from '@/db/repositories/mealPlans';
import { savePrepPlan } from '@/db/repositories/planPrep';
import { getSetting, setSetting } from '@/db/repositories/settings';
import type { AppDb } from '@/db/types';
import { type PlanChoices } from '@/constants/mealPlan';
import { AppError, type ErrorCode } from '@/lib/errors';
import { todayKey } from '@/lib/kitchen';
import { logger } from '@/lib/logger';
import { buildPlanRequest, mealsFromResult, planSlots, planWeekStart } from '@/lib/mealPlan';
import { prepDishes } from '@/lib/prep';
import { buildPrepRequest, prepAliases, prepFitsDishes, prepSignature } from '@/lib/prepPlan';
import { planWeekResult } from '@/lib/weekResult';
import { fetchMealPlan, fetchPrepPlan } from '@/services/relayClient';
import { askForReminders, cancelPrepReminder, notifyPlanReady } from '@/services/reminders';

/**
 * Making the week plan is a job of its own, not something a screen owns (Figma "meal planning flow" C3, N1, F3, F3b).
 * It asks the relay for the meals and then, for a cook-once plan, for the prep session, saves both, and tells the
 * person with a notification when they are not watching. Leaving the page does not stop it: the screens only watch
 * its state. The state lives in this module, so it lasts as long as the app process does; if the phone suspends the
 * app, the request carries on when it wakes, and a plan that never finished simply never appears.
 */

export type PlanJobState = {
  /** 'running' while the relay works, 'failed' until it is tried again, 'idle' otherwise. */
  status: 'idle' | 'running' | 'failed';
  errorCode: ErrorCode | null;
  /** Changes each time a plan has been saved, so a screen knows to read it again. */
  finishedAt: number;
  /** When the last failure happened, so a page can tell an old failure from its own. */
  failedAt: number;
};

export type PlanJobOptions = { repeat: boolean };

const IDLE: PlanJobState = { status: 'idle', errorCode: null, finishedAt: 0, failedAt: 0 };

let state: PlanJobState = IDLE;
let lastOptions: PlanJobOptions = { repeat: false };
let watchers = 0;
const listeners = new Set<() => void>();

function set(next: PlanJobState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export function getPlanJob(): PlanJobState {
  return state;
}

export function subscribePlanJob(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The job's state, for a screen that shows it. */
export function usePlanJob(): PlanJobState {
  return useSyncExternalStore(subscribePlanJob, getPlanJob, getPlanJob);
}

/**
 * Marks the waiting page as open, so a finished plan does not also send a notification to someone looking at it.
 * Returns the function that says it was closed.
 */
export function watchPlanJob(): () => void {
  watchers += 1;
  return () => {
    watchers = Math.max(0, watchers - 1);
  };
}

/** For tests: forgets everything. */
export function resetPlanJob(): void {
  watchers = 0;
  lastOptions = { repeat: false };
  set(IDLE);
}

/** The prep day moves (or goes) with the plan, so a reminder for the old one is dropped; it can be turned on again. */
export function dropPrepReminder(db: AppDb): void {
  try {
    if (getSetting(db, 'prepReminderPlan') === null) return;
    setSetting(db, 'prepReminderPlan', null);
    void cancelPrepReminder();
  } catch (error) {
    logger.error('dropPrepReminder', error);
  }
}

/** The dishes of the current plan that sat well, from the diary; none if it cannot be read. */
function keptDishes(db: AppDb): string[] {
  try {
    const old = getCurrentPlan(db);
    return old ? planWeekResult(db, old).wellTitles : [];
  } catch (error) {
    logger.error('keptDishes', error);
    return [];
  }
}

/**
 * Lines up the cooking of a cook-once plan and keeps it, so the prep day opens at once. It never throws: if it cannot
 * be made, the prep day page asks again when it is opened. Returns whether there is a prep session to tell about.
 */
async function makePrep(db: AppDb, plan: StoredPlan): Promise<boolean> {
  if (plan.mode !== 'once') return false;
  const dishes = prepDishes(plan.meals, todayKey());
  // One dish has nothing to share with another, so it never asks the relay.
  if (dishes.length === 0) return false;
  if (dishes.length === 1) return true;
  try {
    const answer = await fetchPrepPlan(buildPrepRequest(dishes, plan.choices.prepMinutes));
    if (!prepFitsDishes(answer, prepAliases(dishes))) throw new AppError('AI_INVALID_OUTPUT');
    savePrepPlan(db, plan.id, prepSignature(dishes), answer);
  } catch (error) {
    logger.error('prepPlanInJob', error);
  }
  return true;
}

type Ask = {
  request: ReturnType<typeof buildPlanRequest>;
  slots: ReturnType<typeof planSlots>;
  weekStart: string;
  choices: PlanChoices;
};

async function run(db: AppDb, ask: Ask): Promise<void> {
  const began = Date.now();
  try {
    const result = await fetchMealPlan(ask.request);
    const meals = mealsFromResult(result, ask.slots);
    if (!meals) throw new AppError('AI_INVALID_OUTPUT');
    const saved = createPlan(db, { weekStart: ask.weekStart, choices: ask.choices, meals });
    dropPrepReminder(db);
    // Until they have looked it over, the Kitchen offers a "Review your meal plan" banner instead of the week.
    try {
      setSetting(db, 'reviewPlan', saved.id);
    } catch (error) {
      logger.error('markPlanToReview', error);
    }
    const withPrep = await makePrep(db, saved);
    // How long it really took, to tune what the waiting page promises. Development only; nothing is sent anywhere.
    logger.debug(`planJob ${Math.round((Date.now() - began) / 1000)}s`);
    set({ status: 'idle', errorCode: null, finishedAt: Date.now(), failedAt: state.failedAt });
    // Someone looking at the waiting page sees it fill in; anyone else is told.
    if (!(watchers > 0 && AppState.currentState === 'active')) void notifyPlanReady(withPrep);
  } catch (error) {
    logger.error('makeMealPlan', error);
    set({
      status: 'failed',
      errorCode: error instanceof AppError ? error.code : 'INTERNAL',
      finishedAt: state.finishedAt,
      failedAt: Date.now(),
    });
  }
}

/** Whether any day is left to plan from the saved choices (a plan made late on a Saturday can have none). */
export function planHasDays(db: AppDb): boolean {
  try {
    const today = todayKey();
    return planSlots(getSetting(db, 'planChoices'), planWeekStart(today), today).length > 0;
  } catch (error) {
    logger.error('planHasDays', error);
    return true;
  }
}

/**
 * Starts making the week plan from the saved set-up choices. 'started' once it is running, 'running' when one already
 * is (nothing starts twice), and 'empty' when no day is left to plan, which is not a failure of the relay.
 */
export function startPlanJob(
  db: AppDb,
  options: PlanJobOptions,
  retrying = false,
): 'started' | 'running' | 'empty' | 'failed' {
  if (state.status === 'running') return 'running';
  lastOptions = options;
  try {
    const today = todayKey();
    const choices = getSetting(db, 'planChoices');
    const weekStart = planWeekStart(today);
    const slots = planSlots(choices, weekStart, today);
    if (slots.length === 0) return 'empty';
    const request = buildPlanRequest(db, {
      choices,
      slots,
      // "Repeat what worked": the dishes that sat well last week are kept, and the rest is planned around them.
      keep: options.repeat ? keptDishes(db) : [],
      serves: getSetting(db, 'kitchenServes'),
      conditions: getSetting(db, 'conditions'),
    });
    set({ status: 'running', errorCode: null, finishedAt: state.finishedAt, failedAt: state.failedAt });
    // So the phone's one-time question about notifications comes now, while they are choosing to wait; not again on a retry.
    if (!retrying) void askForReminders();
    void run(db, { request, slots, weekStart, choices });
    return 'started';
  } catch (error) {
    logger.error('startPlanJob', error);
    set({ status: 'failed', errorCode: 'INTERNAL', finishedAt: state.finishedAt, failedAt: Date.now() });
    return 'failed';
  }
}

/** "Try again" after a failure: the same plan is asked for again. */
export function retryPlanJob(db: AppDb): 'started' | 'running' | 'empty' | 'failed' {
  return startPlanJob(db, lastOptions, true);
}
