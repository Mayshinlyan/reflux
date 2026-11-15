import { DEFAULT_PLAN_CHOICES } from '@/constants/mealPlan';
import type { PlanDish } from '@/types/mealPlan';

import { deleteAllData } from '../repositories/data';
import {
  createPlan,
  deletePlan,
  getCurrentPlan,
  getMeal,
  type NewMeal,
  setMealSkipped,
  swapMeal,
} from '../repositories/mealPlans';
import { DEFAULT_SETTINGS, getSetting, setSetting } from '../repositories/settings';
import { mealPlans, plannedMeals } from '../schema';
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

const dish = (id: string, title: string, keepsDays = 4): PlanDish => ({
  id,
  title,
  minutes: 30,
  serves: 2,
  why: 'Gentle.',
  tip: '',
  keepsDays,
  ingredients: ['1 cup rice'],
  steps: ['Cook it.'],
});

const meals: NewMeal[] = [
  { day: '2026-11-17', slot: 'dinner', dish: dish('d2', 'Miso salmon') },
  { day: '2026-11-16', slot: 'dinner', dish: dish('d2', 'Miso salmon') },
  { day: '2026-11-16', slot: 'lunch', dish: dish('d1', 'Chicken bowls') },
];

describe('meal plans', () => {
  it('has no plan until one is made', () => {
    expect(getCurrentPlan(db)).toBeNull();
  });

  it('saves a plan and lists its meals in the order they are eaten', () => {
    const plan = createPlan(db, { weekStart: '2026-11-16', choices: DEFAULT_PLAN_CHOICES, meals });

    expect(plan.weekStart).toBe('2026-11-16');
    expect(plan.mode).toBe('once');
    expect(plan.choices).toEqual(DEFAULT_PLAN_CHOICES);
    expect(plan.meals.map((meal) => `${meal.day} ${meal.slot} ${meal.dish.title}`)).toEqual([
      '2026-11-16 lunch Chicken bowls',
      '2026-11-16 dinner Miso salmon',
      '2026-11-17 dinner Miso salmon',
    ]);
    expect(plan.meals.every((meal) => !meal.locked && !meal.skipped)).toBe(true);
  });

  it('keeps only the newest plan: an older one and its meals are deleted', () => {
    createPlan(db, { weekStart: '2026-11-09', choices: DEFAULT_PLAN_CHOICES, meals });
    const newer = createPlan(db, {
      weekStart: '2026-11-16',
      choices: DEFAULT_PLAN_CHOICES,
      meals: meals.slice(0, 1),
    });

    expect(db.select().from(mealPlans).all()).toHaveLength(1);
    expect(db.select().from(plannedMeals).all()).toHaveLength(1);
    expect(getCurrentPlan(db)?.id).toBe(newer.id);
  });

  it('shows the newest plan as the current one', () => {
    createPlan(db, { weekStart: '2026-11-09', choices: DEFAULT_PLAN_CHOICES, meals: meals.slice(0, 1) });
    const newer = createPlan(db, {
      weekStart: '2026-11-16',
      choices: { ...DEFAULT_PLAN_CHOICES, mode: 'daily' },
      meals,
    });

    const current = getCurrentPlan(db);
    expect(current?.id).toBe(newer.id);
    expect(current?.mode).toBe('daily');
  });

  it('refuses a second meal in the same slot', () => {
    expect(() =>
      createPlan(db, {
        weekStart: '2026-11-16',
        choices: DEFAULT_PLAN_CHOICES,
        meals: [meals[1]!, { ...meals[1]!, dish: dish('d9', 'Other') }],
      }),
    ).toThrow();
  });

  it('swaps a meal for another dish', () => {
    const plan = createPlan(db, { weekStart: '2026-11-16', choices: DEFAULT_PLAN_CHOICES, meals });
    const first = plan.meals[0]!;
    setMealSkipped(db, first.id, true);

    swapMeal(db, first.id, dish('s1', 'Tofu stir fry', 0));

    const swapped = getMeal(db, first.id);
    expect(swapped?.dish.title).toBe('Tofu stir fry');
    expect(swapped?.dishId).toBe('s1');
    expect(swapped?.skipped).toBe(false);
  });

  it('skips a meal and takes it back', () => {
    const plan = createPlan(db, { weekStart: '2026-11-16', choices: DEFAULT_PLAN_CHOICES, meals });
    const first = plan.meals[0]!;
    setMealSkipped(db, first.id, true);
    expect(getMeal(db, first.id)?.skipped).toBe(true);
    setMealSkipped(db, first.id, false);
    expect(getMeal(db, first.id)?.skipped).toBe(false);
  });

  it('leaves out a meal whose stored dish is unreadable instead of failing', () => {
    const plan = createPlan(db, { weekStart: '2026-11-16', choices: DEFAULT_PLAN_CHOICES, meals });
    db.update(plannedMeals)
      .set({ recipe: { nope: true } })
      .run();
    expect(getCurrentPlan(db)?.id).toBe(plan.id);
    expect(getCurrentPlan(db)?.meals).toEqual([]);
  });

  it('deletes a plan with its meals', () => {
    const plan = createPlan(db, { weekStart: '2026-11-16', choices: DEFAULT_PLAN_CHOICES, meals });
    deletePlan(db, plan.id);
    expect(getCurrentPlan(db)).toBeNull();
    expect(db.select().from(plannedMeals).all()).toEqual([]);
  });

  it('is wiped by delete all data', () => {
    createPlan(db, { weekStart: '2026-11-16', choices: DEFAULT_PLAN_CHOICES, meals });
    deleteAllData(db);
    expect(getCurrentPlan(db)).toBeNull();
  });
});

describe('plan choices setting', () => {
  it('opens on the defaults, then as it was left', () => {
    expect(getSetting(db, 'planChoices')).toEqual(DEFAULT_SETTINGS.planChoices);
    const left = { ...DEFAULT_PLAN_CHOICES, mode: 'daily' as const, cuisines: ['korean' as const] };
    setSetting(db, 'planChoices', left);
    expect(getSetting(db, 'planChoices')).toEqual(left);
  });

  it('refuses choices that are not valid', () => {
    expect(() => setSetting(db, 'planChoices', { ...DEFAULT_PLAN_CHOICES, meals: [] })).toThrow(
      'planChoices',
    );
  });
});
