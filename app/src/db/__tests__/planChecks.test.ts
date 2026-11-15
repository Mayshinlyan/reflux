import { DEFAULT_PLAN_CHOICES } from '@/constants/mealPlan';

import { deleteAllData } from '../repositories/data';
import {
  createPlan,
  deletePlan,
  getCurrentPlan,
  markMealLogOffered,
  swapMeal,
} from '../repositories/mealPlans';
import { addOwnItem, getPlanChecks, setChecked } from '../repositories/planChecks';
import { getPrepPlan, savePrepPlan } from '../repositories/planPrep';
import { DEFAULT_SETTINGS, getSetting, setSetting } from '../repositories/settings';
import { planChecks, planPrep } from '../schema';
import type { AppDb } from '../types';
import { createTestDb } from './testDb';

let db: AppDb;
let close: () => void;

beforeEach(() => {
  const test = createTestDb();
  db = test.db;
  close = () => test.sqlite.close();
});
afterEach(() => close());

const newPlan = () =>
  createPlan(db, {
    weekStart: '2026-11-16',
    choices: DEFAULT_PLAN_CHOICES,
    meals: [
      {
        day: '2026-11-16',
        slot: 'dinner',
        dish: {
          id: 'd1',
          title: 'Chicken bowls',
          minutes: 30,
          serves: 2,
          why: 'Gentle.',
          tip: '',
          keepsDays: 3,
          ingredients: ['1 cup rice'],
          steps: ['Cook it.'],
        },
      },
    ],
  });

describe('plan checks', () => {
  it('starts empty', () => {
    const plan = newPlan();
    expect(getPlanChecks(db, plan.id)).toEqual({ prep: new Set(), shop: new Set(), own: [] });
  });

  it('ticks and unticks steps and items, each kept apart', () => {
    const plan = newPlan();
    setChecked(db, plan.id, 'prep', 'd1:0', true);
    setChecked(db, plan.id, 'prep', 'd1:0', true);
    setChecked(db, plan.id, 'shop', 'rice', true);
    setChecked(db, plan.id, 'shop', 'carrot', true);
    setChecked(db, plan.id, 'shop', 'carrot', false);

    const checks = getPlanChecks(db, plan.id);
    expect([...checks.prep]).toEqual(['d1:0']);
    expect([...checks.shop]).toEqual(['rice']);
  });

  it('adds items by hand, ignoring blanks and repeats', () => {
    const plan = newPlan();
    expect(addOwnItem(db, plan.id, '  Dish   soap ')).toBe(true);
    expect(addOwnItem(db, plan.id, 'dish soap')).toBe(false);
    expect(addOwnItem(db, plan.id, '   ')).toBe(false);

    expect(getPlanChecks(db, plan.id).own).toEqual(['Dish soap']);
  });

  it('goes with the plan, and with delete all data', () => {
    const plan = newPlan();
    setChecked(db, plan.id, 'prep', 'pack', true);
    deletePlan(db, plan.id);
    expect(db.select().from(planChecks).all()).toHaveLength(0);

    const another = newPlan();
    setChecked(db, another.id, 'prep', 'pack', true);
    deleteAllData(db);
    expect(db.select().from(planChecks).all()).toHaveLength(0);
  });

  it('remembers which plan has a prep reminder, and only a plan id', () => {
    expect(getSetting(db, 'prepReminderPlan')).toBe(DEFAULT_SETTINGS.prepReminderPlan);
    setSetting(db, 'prepReminderPlan', 3);
    expect(getSetting(db, 'prepReminderPlan')).toBe(3);
    expect(() => setSetting(db, 'prepReminderPlan', 0)).toThrow();
  });
});

describe('the saved prep session', () => {
  const result = {
    start: [{ text: 'Heat the oven', feeds: ['d1'] }],
    dishes: [{ dish: 'd1', steps: ['Roast it'] }],
    finish: [],
  };

  it('is kept for a plan and only used while its signature matches', () => {
    const plan = newPlan();
    expect(getPrepPlan(db, plan.id, 'sig1')).toBeNull();

    savePrepPlan(db, plan.id, 'sig1', result);
    expect(getPrepPlan(db, plan.id, 'sig1')).toEqual(result);
    expect(getPrepPlan(db, plan.id, 'sig2')).toBeNull();
  });

  it('is replaced by a newer one, and goes with the plan and with delete all data', () => {
    const plan = newPlan();
    savePrepPlan(db, plan.id, 'sig1', result);
    savePrepPlan(db, plan.id, 'sig2', { ...result, finish: [{ text: 'Pack it', feeds: ['d1'] }] });
    expect(db.select().from(planPrep).all()).toHaveLength(1);
    expect(getPrepPlan(db, plan.id, 'sig1')).toBeNull();
    expect(getPrepPlan(db, plan.id, 'sig2')?.finish).toHaveLength(1);

    deleteAllData(db);
    expect(db.select().from(planPrep).all()).toHaveLength(0);
  });
});

describe('offering planned meals on Today', () => {
  it('is on until turned off, and only takes a switch', () => {
    expect(getSetting(db, 'offerPlannedMeals')).toBe(true);
    setSetting(db, 'offerPlannedMeals', false);
    expect(getSetting(db, 'offerPlannedMeals')).toBe(false);
    expect(() => setSetting(db, 'offerPlannedMeals', 'yes' as unknown as boolean)).toThrow();
  });

  it('remembers the meal the swap offer was last shown for, and only a meal id', () => {
    expect(getSetting(db, 'swapOfferMeal')).toBeNull();
    setSetting(db, 'swapOfferMeal', 4);
    expect(getSetting(db, 'swapOfferMeal')).toBe(4);
    expect(() => setSetting(db, 'swapOfferMeal', 0)).toThrow();
  });

  it('notes when "Log it" was tapped, and forgets it when the meal is swapped', () => {
    const plan = newPlan();
    const meal = plan.meals[0]!;
    expect(meal.loggedAt).toBeNull();
    markMealLogOffered(db, meal.id, '2026-11-16T18:00:00.000Z');
    expect(getCurrentPlan(db)?.meals[0]?.loggedAt).toBe('2026-11-16T18:00:00.000Z');

    swapMeal(db, meal.id, { ...meal.dish, id: 's1', title: 'Soup' });
    expect(getCurrentPlan(db)?.meals[0]?.loggedAt).toBeNull();
  });
});
