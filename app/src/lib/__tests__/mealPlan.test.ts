import { DEFAULT_PLAN_CHOICES, isPlanChoices } from '@/constants/mealPlan';
import { createTestDb } from '@/db/__tests__/testDb';
import { createAvoidFood } from '@/db/repositories/avoidFoods';
import { replaceFridge } from '@/db/repositories/fridgeItems';
import type { MealPlanResult, PlanDish } from '@/types/mealPlan';

import {
  buildPlanRequest,
  mealsFromResult,
  planSlots,
  planSummary,
  planWeek,
  planWeekStart,
  weekdayOf,
} from '../mealPlan';
import { isMealPlanResult, isPlanDish } from '../planDish';

const dish: PlanDish = {
  id: 'd1',
  title: 'Gochujang chicken bowls',
  minutes: 60,
  serves: 4,
  why: 'Lean chicken and soft rice.',
  tip: '',
  keepsDays: 4,
  ingredients: ['1 1/2 lb chicken thighs', '2 cups rice'],
  steps: ['Cook the rice.', 'Poach the chicken.'],
};

describe('plan week', () => {
  // 2026-11-16 is a Monday.
  it.each([
    ['a Monday', '2026-11-16', '2026-11-16'],
    ['a Wednesday', '2026-11-18', '2026-11-16'],
    ['a Friday', '2026-11-20', '2026-11-16'],
    ['a Saturday (plans the week ahead)', '2026-11-21', '2026-11-23'],
    ['a Sunday (plans the week ahead)', '2026-11-22', '2026-11-23'],
  ])('starts on the right Monday for %s', (_name, today, monday) => {
    expect(weekdayOf(monday)).toBe(1);
    expect(planWeekStart(today)).toBe(monday);
  });

  it('lists seven days, Monday first', () => {
    const week = planWeek('2026-11-16');
    expect(week.map((day) => day.letter).join('')).toBe('MTWTFSS');
    expect(week.map((day) => day.date)).toEqual([16, 17, 18, 19, 20, 21, 22]);
    expect(week[0]?.name).toBe('Monday');
  });
});

describe('planSlots', () => {
  const choices = { weekdays: [1, 2, 3, 4, 6, 0], meals: ['dinner', 'lunch'] as const };

  it('gives each chosen meal on each chosen day, in the order they are eaten, skipping unchosen days', () => {
    const slots = planSlots({ ...choices, meals: [...choices.meals] }, '2026-11-16', '2026-11-16');
    // Friday (weekday 5) is off: 6 days x 2 meals.
    expect(slots).toHaveLength(12);
    expect(slots[0]).toEqual({ day: '2026-11-16', slot: 'lunch' });
    expect(slots[1]).toEqual({ day: '2026-11-16', slot: 'dinner' });
    expect(slots.some((slot) => slot.day === '2026-11-20')).toBe(false);
  });

  it('leaves out days that have already passed', () => {
    const slots = planSlots(
      { weekdays: [1, 2, 3, 4, 5, 6, 0], meals: ['dinner'] },
      '2026-11-16',
      '2026-11-18',
    );
    expect(slots.map((slot) => slot.day)[0]).toBe('2026-11-18');
    expect(slots).toHaveLength(5);
  });
});

describe('planSummary', () => {
  const meals = [
    { dishId: 'd1', skipped: false },
    { dishId: 'd1', skipped: false },
    { dishId: 'd2', skipped: false },
    { dishId: 'd3', skipped: true },
  ];
  it('counts meals and dishes to prep in cook once, ignoring skipped meals', () => {
    expect(planSummary(meals, 'once')).toBe('3 meals, 2 dishes to prep');
  });
  it('counts only meals in cook daily', () => {
    expect(planSummary(meals, 'daily')).toBe('3 meals');
  });
  it('uses the singular', () => {
    expect(planSummary([{ dishId: 'd1', skipped: false }], 'once')).toBe('1 meal, 1 dish to prep');
  });
});

describe('buildPlanRequest', () => {
  it('sends the choices and food names only, leaves empty lists out, and the prep time only for cook once', () => {
    const { db, sqlite } = createTestDb();
    try {
      createAvoidFood(db, 'pork');
      replaceFridge(db, ['eggs', 'rice']);
      const slots = [{ day: '2026-11-16', slot: 'dinner' as const }];
      const once = buildPlanRequest(db, {
        choices: { ...DEFAULT_PLAN_CHOICES, cuisines: ['korean'] },
        slots,
        keep: ['Miso soup'],
        serves: 2,
        conditions: ['acid_reflux', 'unsure'],
      });
      expect(once).toEqual({
        mode: 'once',
        slots,
        keep: ['Miso soup'],
        cuisines: ['korean'],
        prepMinutes: 120,
        serves: 2,
        conditions: ['acid_reflux'],
        fridge: ['eggs', 'rice'],
        avoid: ['pork'],
      });

      const daily = buildPlanRequest(db, {
        choices: { ...DEFAULT_PLAN_CHOICES, mode: 'daily', useFridge: false },
        slots,
        keep: [],
        serves: 1,
        conditions: ['unsure'],
      });
      expect(daily).toEqual({ mode: 'daily', slots, cuisines: ['any'], serves: 1, avoid: ['pork'] });
    } finally {
      sqlite.close();
    }
  });
});

describe('plan answers', () => {
  const result: MealPlanResult = {
    dishes: [dish],
    meals: [{ day: '2026-11-16', slot: 'lunch', dish: 'd1' }],
  };

  it('accepts a dish and a plan whose meals all point at a dish', () => {
    expect(isPlanDish(dish)).toBe(true);
    expect(isMealPlanResult(result)).toBe(true);
  });

  it.each([
    ['a dish with no id', { ...dish, id: '' }],
    ['a dish with keepsDays as text', { ...dish, keepsDays: 'a few' }],
    ['a negative keepsDays', { ...dish, keepsDays: -1 }],
  ])('refuses %s', (_name, bad) => {
    expect(isPlanDish(bad)).toBe(false);
  });

  it.each([
    ['no dishes', { ...result, dishes: [] }],
    ['no meals', { ...result, meals: [] }],
    [
      'a meal pointing at a missing dish',
      { ...result, meals: [{ day: '2026-11-16', slot: 'lunch', dish: 'd9' }] },
    ],
    ['a meal with a bad day', { ...result, meals: [{ day: 'Monday', slot: 'lunch', dish: 'd1' }] }],
    ['a meal with a bad slot', { ...result, meals: [{ day: '2026-11-16', slot: 'brunch', dish: 'd1' }] }],
    ['text', 'here is your plan'],
    ['null', null],
  ])('refuses %s', (_name, bad) => {
    expect(isMealPlanResult(bad)).toBe(false);
  });
});

describe('plan choices', () => {
  it('accepts the defaults', () => {
    expect(isPlanChoices(DEFAULT_PLAN_CHOICES)).toBe(true);
  });
  it.each([
    ['no weekdays', { ...DEFAULT_PLAN_CHOICES, weekdays: [] }],
    ['a weekday out of range', { ...DEFAULT_PLAN_CHOICES, weekdays: [7] }],
    ['repeated weekdays', { ...DEFAULT_PLAN_CHOICES, weekdays: [1, 1] }],
    ['no meals', { ...DEFAULT_PLAN_CHOICES, meals: [] }],
    ['an unknown meal', { ...DEFAULT_PLAN_CHOICES, meals: ['brunch'] }],
    ['no cuisines', { ...DEFAULT_PLAN_CHOICES, cuisines: [] }],
    [
      'five cuisines',
      { ...DEFAULT_PLAN_CHOICES, cuisines: ['korean', 'thai', 'indian', 'italian', 'mexican'] },
    ],
    ['an unknown mode', { ...DEFAULT_PLAN_CHOICES, mode: 'weekly' }],
    ['a prep time of 10 minutes', { ...DEFAULT_PLAN_CHOICES, prepMinutes: 10 }],
    ['a fridge switch that is text', { ...DEFAULT_PLAN_CHOICES, useFridge: 'yes' }],
  ])('refuses %s', (_name, bad) => {
    expect(isPlanChoices(bad)).toBe(false);
  });
});

describe('mealsFromResult', () => {
  const slots = [
    { day: '2026-11-16', slot: 'lunch' as const },
    { day: '2026-11-16', slot: 'dinner' as const },
  ];
  const lunch = { day: '2026-11-16', slot: 'lunch', dish: 'd1' };
  const dinner = { day: '2026-11-16', slot: 'dinner', dish: 'd1' };
  const answer = (meals: unknown): MealPlanResult => ({
    dishes: [dish],
    meals: meals as MealPlanResult['meals'],
  });

  it('gives the meals when the answer covers exactly the slots asked for', () => {
    const meals = mealsFromResult(answer([lunch, dinner]), slots);
    expect(meals?.map((meal) => `${meal.day} ${meal.slot} ${meal.dish.title}`)).toEqual([
      '2026-11-16 lunch Gochujang chicken bowls',
      '2026-11-16 dinner Gochujang chicken bowls',
    ]);
  });

  it.each([
    ['a missing meal', [lunch]],
    ['a meal nobody asked for', [lunch, dinner, { ...lunch, day: '2026-11-17' }]],
    ['the same slot twice', [lunch, lunch]],
    ['a dish that does not exist', [{ ...lunch, dish: 'd9' }, dinner]],
  ])('refuses an answer with %s', (_name, meals) => {
    expect(mealsFromResult(answer(meals), slots)).toBeNull();
  });
});
