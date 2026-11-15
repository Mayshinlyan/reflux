import { DEFAULT_PLAN_CHOICES } from '@/constants/mealPlan';

import { deleteAllData } from '../repositories/data';
import { createPlan, deletePlan } from '../repositories/mealPlans';
import { addOwnItem, getPlanChecks, setChecked } from '../repositories/planChecks';
import { DEFAULT_SETTINGS, getSetting, setSetting } from '../repositories/settings';
import { planChecks } from '../schema';
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
