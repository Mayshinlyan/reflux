import { AppState } from 'react-native';

import { DEFAULT_PLAN_CHOICES } from '@/constants/mealPlan';
import { createTestDb } from '@/db/__tests__/testDb';
import { getCurrentPlan } from '@/db/repositories/mealPlans';
import { getPrepPlan } from '@/db/repositories/planPrep';
import { getSetting, setSetting } from '@/db/repositories/settings';
import type { AppDb } from '@/db/types';
import { AppError } from '@/lib/errors';
import { prepDishes } from '@/lib/prep';
import { prepSignature } from '@/lib/prepPlan';
import { todayKey } from '@/lib/kitchen';
import type { MealPlanRequest, PlanDish } from '@/types/mealPlan';

import {
  getPlanJob,
  planHasDays,
  resetPlanJob,
  retryPlanJob,
  startPlanJob,
  subscribePlanJob,
  watchPlanJob,
} from '../planJob';
import { fetchMealPlan, fetchPrepPlan } from '../relayClient';
import { askForReminders, cancelPrepReminder, notifyPlanReady } from '../reminders';

jest.mock('../relayClient', () => ({ fetchMealPlan: jest.fn(), fetchPrepPlan: jest.fn() }));
jest.mock('../reminders', () => ({
  askForReminders: jest.fn(() => Promise.resolve(true)),
  cancelPrepReminder: jest.fn(() => Promise.resolve()),
  notifyPlanReady: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn(), debug: jest.fn() } }));

const planFetch = fetchMealPlan as jest.Mock;
const prepFetch = fetchPrepPlan as jest.Mock;
const notify = notifyPlanReady as jest.Mock;

let db: AppDb;
let closeDb: () => void;

const dish = (id: string, title: string): PlanDish => ({
  title,
  minutes: 30,
  serves: 2,
  why: 'Soft and mild.',
  tip: '',
  ingredients: ['1 cup rice'],
  steps: ['Cook the rice.'],
  id,
  keepsDays: 3,
});

/** Lunches are one dish and dinners another, so a cook-once plan has two dishes to line up. */
const twoDishes = async (request: MealPlanRequest) => ({
  dishes: [dish('d1', 'Chicken bowls'), dish('d2', 'Miso salmon')],
  meals: request.slots.map((slot) => ({
    day: slot.day,
    slot: slot.slot,
    dish: slot.slot === 'lunch' ? 'd1' : 'd2',
  })),
});
const oneDish = async (request: MealPlanRequest) => ({
  dishes: [dish('d1', 'Chicken bowls')],
  meals: request.slots.map((slot) => ({ day: slot.day, slot: slot.slot, dish: 'd1' })),
});

const lined = {
  start: [{ text: 'Heat the oven', feeds: ['d1', 'd2'] }],
  dishes: [
    { dish: 'd1', steps: ['Roast the chicken'] },
    { dish: 'd2', steps: ['Roast the salmon'] },
  ],
  finish: [{ text: 'Cool and pack', feeds: ['d1', 'd2'] }],
};

/** Waits until the job is no longer running. */
const finished = () =>
  new Promise<void>((resolve) => {
    if (getPlanJob().status !== 'running') return resolve();
    const stop = subscribePlanJob(() => {
      if (getPlanJob().status === 'running') return;
      stop();
      resolve();
    });
  });

beforeEach(() => {
  const made = createTestDb();
  db = made.db;
  closeDb = () => made.sqlite.close();
  jest.clearAllMocks();
  planFetch.mockReset();
  prepFetch.mockReset();
  resetPlanJob();
  setSetting(db, 'planChoices', DEFAULT_PLAN_CHOICES);
});
afterEach(() => closeDb());

describe('the plan job', () => {
  it('makes the meal plan, then the prep session, keeps both and tells them it is ready', async () => {
    const order: string[] = [];
    planFetch.mockImplementation(async (request: MealPlanRequest) => {
      order.push('plan');
      return twoDishes(request);
    });
    prepFetch.mockImplementation(async () => {
      order.push('prep');
      return lined;
    });

    expect(startPlanJob(db, { repeat: false })).toBe('started');
    expect(getPlanJob().status).toBe('running');
    await finished();

    expect(order).toEqual(['plan', 'prep']);
    const plan = getCurrentPlan(db);
    expect(plan?.meals.length).toBeGreaterThan(0);
    const dishes = prepDishes(plan!.meals, todayKey());
    expect(getPrepPlan(db, plan!.id, prepSignature(dishes))).toEqual(lined);
    expect(getPlanJob().status).toBe('idle');
    expect(getPlanJob().finishedAt).toBeGreaterThan(0);
    expect(notify).toHaveBeenCalledWith(true);
  });

  it('asks for permission to notify as it starts, not when it ends', async () => {
    planFetch.mockImplementation(oneDish);
    startPlanJob(db, { repeat: false });
    expect(askForReminders).toHaveBeenCalledTimes(1);
    await finished();
    expect(askForReminders).toHaveBeenCalledTimes(1);
  });

  it('does not start twice while one is running', async () => {
    planFetch.mockImplementation(oneDish);
    expect(startPlanJob(db, { repeat: false })).toBe('started');
    expect(startPlanJob(db, { repeat: false })).toBe('running');
    await finished();
    expect(planFetch).toHaveBeenCalledTimes(1);
  });

  it('does not ask the relay to line up one dish with nothing', async () => {
    planFetch.mockImplementation(oneDish);
    startPlanJob(db, { repeat: false });
    await finished();

    expect(prepFetch).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(true);
  });

  it('makes no prep session for a plan that cooks every day, and says only the plan is ready', async () => {
    setSetting(db, 'planChoices', { ...DEFAULT_PLAN_CHOICES, mode: 'daily' });
    planFetch.mockImplementation(twoDishes);
    startPlanJob(db, { repeat: false });
    await finished();

    expect(prepFetch).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(false);
  });

  it('keeps the plan when the prep session cannot be made, and still says it is ready', async () => {
    planFetch.mockImplementation(twoDishes);
    prepFetch.mockRejectedValue(new AppError('AI_TIMEOUT'));
    startPlanJob(db, { repeat: false });
    await finished();

    const plan = getCurrentPlan(db);
    expect(plan).not.toBeNull();
    expect(getPrepPlan(db, plan!.id, prepSignature(prepDishes(plan!.meals, todayKey())))).toBeNull();
    expect(getPlanJob().status).toBe('idle');
    expect(notify).toHaveBeenCalledWith(true);
  });

  it('does not keep a prep session that does not fit the dishes', async () => {
    planFetch.mockImplementation(twoDishes);
    prepFetch.mockResolvedValue({ ...lined, dishes: lined.dishes.slice(0, 1) });
    startPlanJob(db, { repeat: false });
    await finished();

    const plan = getCurrentPlan(db);
    expect(getPrepPlan(db, plan!.id, prepSignature(prepDishes(plan!.meals, todayKey())))).toBeNull();
  });

  it('does not tell someone who is looking at the waiting page, unless the app is in the background', async () => {
    planFetch.mockImplementation(oneDish);
    const original = AppState.currentState;
    const setState = (value: string) =>
      Object.defineProperty(AppState, 'currentState', { value, configurable: true, writable: true });
    setState('active');
    const leave = watchPlanJob();
    startPlanJob(db, { repeat: false });
    await finished();
    expect(notify).not.toHaveBeenCalled();

    resetPlanJob();
    watchPlanJob();
    setState('background');
    startPlanJob(db, { repeat: false });
    await finished();
    expect(notify).toHaveBeenCalledTimes(1);
    Object.defineProperty(AppState, 'currentState', { value: original, configurable: true, writable: true });
    leave();
  });

  it('goes on when nobody is watching: the plan is saved with no screen open', async () => {
    planFetch.mockImplementation(oneDish);
    startPlanJob(db, { repeat: false });
    // No subscriber, no watcher: the screens that started it are gone.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(getCurrentPlan(db)).not.toBeNull();
    expect(getPlanJob().status).toBe('idle');
  });

  it('fails without keeping a half plan or sending a notification, and tries again from the same choices', async () => {
    planFetch.mockRejectedValueOnce(new AppError('AI_TIMEOUT')).mockImplementationOnce(oneDish);
    startPlanJob(db, { repeat: false });
    await finished();

    expect(getPlanJob()).toMatchObject({ status: 'failed', errorCode: 'AI_TIMEOUT' });
    expect(getCurrentPlan(db)).toBeNull();
    expect(notify).not.toHaveBeenCalled();

    expect(retryPlanJob(db)).toBe('started');
    expect(getPlanJob().status).toBe('running');
    await finished();

    expect(getPlanJob().status).toBe('idle');
    expect(getCurrentPlan(db)).not.toBeNull();
    expect(planFetch).toHaveBeenCalledTimes(2);
  });

  it('refuses an answer that leaves a meal out', async () => {
    planFetch.mockImplementation(async (request: MealPlanRequest) => ({
      dishes: [dish('d1', 'Chicken bowls')],
      meals: request.slots.slice(1).map((slot) => ({ day: slot.day, slot: slot.slot, dish: 'd1' })),
    }));
    startPlanJob(db, { repeat: false });
    await finished();

    expect(getPlanJob()).toMatchObject({ status: 'failed', errorCode: 'AI_INVALID_OUTPUT' });
    expect(getCurrentPlan(db)).toBeNull();
  });

  it('drops the old prep day reminder when a new plan is made', async () => {
    setSetting(db, 'prepReminderPlan', 5);
    planFetch.mockImplementation(oneDish);
    startPlanJob(db, { repeat: false });
    await finished();

    expect(getSetting(db, 'prepReminderPlan')).toBeNull();
    expect(cancelPrepReminder).toHaveBeenCalled();
  });

  it('says nothing is left to plan, instead of starting, when no day is left', () => {
    // A Wednesday, with only Monday chosen: Monday of this week has gone.
    jest.useFakeTimers({ now: new Date(2026, 10, 18, 12) });
    try {
      setSetting(db, 'planChoices', { ...DEFAULT_PLAN_CHOICES, weekdays: [1] });
      expect(planHasDays(db)).toBe(false);
      expect(startPlanJob(db, { repeat: false })).toBe('empty');
      expect(getPlanJob().status).toBe('idle');
      expect(planFetch).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
