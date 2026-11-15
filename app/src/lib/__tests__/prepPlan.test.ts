import type { StoredMeal } from '@/db/repositories/mealPlans';
import type { PlanDish } from '@/types/mealPlan';
import type { PrepPlanResult } from '@/types/prepPlan';

import { prepDishes } from '../prep';
import {
  buildPrepRequest,
  isPrepPlanResult,
  keepsLine,
  prepAliases,
  prepFitsDishes,
  prepSections,
  prepSignature,
} from '../prepPlan';

const dish = (id: string, title: string, over: Partial<PlanDish> = {}): PlanDish => ({
  id,
  title,
  minutes: 40,
  serves: 2,
  why: 'Gentle.',
  tip: '',
  keepsDays: 3,
  ingredients: ['2 cups rice'],
  steps: [`Cook the ${title}.`],
  ...over,
});
let next = 1;
const meal = (day: string, d: PlanDish): StoredMeal => ({
  id: next++,
  day,
  slot: 'dinner',
  dishId: d.id,
  dish: d,
  locked: false,
  skipped: false,
  loggedAt: null,
});

const bowls = dish('a', 'Chicken bowls', { minutes: 60, keepsDays: 4 });
const swapped = dish('s1abcdefgh', 'Miso soup', { keepsDays: 0 });
const dishes = prepDishes([
  meal('2026-11-16', bowls),
  meal('2026-11-17', bowls),
  meal('2026-11-18', swapped),
]);
const aliases = prepAliases(dishes);
const answer: PrepPlanResult = {
  start: [
    { text: 'Heat the oven', feeds: ['d1', 'd2'] },
    { text: 'Poach the chicken', feeds: ['d1'] },
  ],
  dishes: [
    { dish: 'd2', steps: ['Whisk in the miso'] },
    { dish: 'd1', steps: ['Roast the carrots', 'Toss with the sauce'] },
  ],
  finish: [{ text: 'Pack and label', feeds: ['d1', 'd2'] }],
};

describe('the request for a prep session', () => {
  it('sends short ids for the dishes, with how many meals each feeds, and nothing else', () => {
    const request = buildPrepRequest(dishes, 120);

    expect(request.prepMinutes).toBe(120);
    expect(request.dishes.map((entry) => entry.id)).toEqual(['d1', 'd2']);
    expect(request.dishes[0]).toEqual({
      id: 'd1',
      title: 'Chicken bowls',
      minutes: 60,
      keepsDays: 4,
      meals: 2,
      ingredients: ['2 cups rice'],
      steps: ['Cook the Chicken bowls.'],
    });
    expect(aliases.get('d2')).toBe('s1abcdefgh');
    expect(Object.keys(request.dishes[0]!).sort()).toEqual(
      ['id', 'ingredients', 'keepsDays', 'meals', 'minutes', 'steps', 'title'].sort(),
    );
  });

  it('keeps long text and big lists inside what the relay accepts', () => {
    const long = dish('l', 'x'.repeat(100), {
      ingredients: Array.from({ length: 30 }, () => 'y'.repeat(200)),
      steps: Array.from({ length: 20 }, () => 'z'.repeat(400)),
    });
    const request = buildPrepRequest(prepDishes([meal('2026-11-16', long)]), 500);

    expect(request.dishes[0]!.title).toHaveLength(60);
    expect(request.dishes[0]!.ingredients).toHaveLength(20);
    expect(request.dishes[0]!.ingredients[0]).toHaveLength(120);
    expect(request.dishes[0]!.steps).toHaveLength(12);
    expect(request.dishes[0]!.steps[0]).toHaveLength(240);
    expect(request.prepMinutes).toBeUndefined();
  });

  it('has a signature that ignores how many meals are left, so a passing day keeps the ticks', () => {
    const fewer = prepDishes([meal('2026-11-17', bowls), meal('2026-11-18', swapped)]);
    expect(prepSignature(fewer)).toBe(prepSignature(dishes));
  });

  it('plans at most eight dishes, with aliases that match what is sent', () => {
    const many = prepDishes(
      Array.from({ length: 10 }, (_, i) => meal('2026-11-16', dish(`x${i}`, `Dish ${i}`))),
    );
    expect(buildPrepRequest(many, 120).dishes).toHaveLength(8);
    expect(prepAliases(many).size).toBe(8);
  });

  it('has a signature that changes when a dish or its steps change', () => {
    const same = prepSignature(dishes);
    expect(
      prepSignature(
        prepDishes([meal('2026-11-16', bowls), meal('2026-11-17', bowls), meal('2026-11-18', swapped)]),
      ),
    ).toBe(same);
    const changed = dish('a', 'Chicken bowls', { minutes: 60, keepsDays: 4, steps: ['Do something else.'] });
    expect(prepSignature(prepDishes([meal('2026-11-16', changed), meal('2026-11-18', swapped)]))).not.toBe(
      same,
    );
  });
});

describe('the relay answer', () => {
  it('is recognised by its shape', () => {
    expect(isPrepPlanResult(answer)).toBe(true);
    expect(isPrepPlanResult({ ...answer, dishes: [] })).toBe(false);
    expect(isPrepPlanResult({ ...answer, start: [{ text: '', feeds: [] }] })).toBe(false);
    expect(isPrepPlanResult(null)).toBe(false);
  });

  it('must cover every dish once and point only at dishes that were sent', () => {
    expect(prepFitsDishes(answer, aliases)).toBe(true);
    expect(prepFitsDishes({ ...answer, dishes: answer.dishes.slice(0, 1) }, aliases)).toBe(false);
    expect(prepFitsDishes({ ...answer, dishes: [answer.dishes[0]!, answer.dishes[0]!] }, aliases)).toBe(
      false,
    );
    expect(prepFitsDishes({ ...answer, start: [{ text: 'x', feeds: ['d9'] }] }, aliases)).toBe(false);
  });
});

describe('the prep day sections', () => {
  const sig = prepSignature(dishes);

  it('puts the shared steps first, then each dish under its title, then the finish', () => {
    const sections = prepSections(dishes, sig, answer, aliases);

    expect(sections.map((section) => section.title)).toEqual([
      'Start together',
      'Miso soup',
      'Chicken bowls',
      'Finish together',
    ]);
    expect(sections[0]!.steps.map((step) => `${step.text} (${step.caption})`)).toEqual([
      'Heat the oven (Both dishes)',
      'Poach the chicken (Chicken bowls)',
    ]);
    expect(sections[1]!.meta).toBe('Eat it the day it is cooked');
    expect(sections[2]!.meta).toBe('Keeps 4 days');
    expect(sections[2]!.steps.map((step) => step.text)).toEqual(['Roast the carrots', 'Toss with the sauce']);
    expect(sections[3]!.steps[0]!.caption).toBe('Both dishes');
  });

  it('skips a dish with nothing of its own left, and keeps step keys unique', () => {
    const sections = prepSections(
      dishes,
      sig,
      { ...answer, dishes: [answer.dishes[0]!, { dish: 'd1', steps: [] }] },
      aliases,
    );
    expect(sections.map((section) => section.title)).not.toContain('Chicken bowls');
    const keys = prepSections(dishes, sig, answer, aliases).flatMap((section) =>
      section.steps.map((step) => step.key),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('lists each dish on its own, with one step to pack, when there is no session', () => {
    const sections = prepSections(dishes, sig, null, aliases);

    expect(sections.map((section) => section.title)).toEqual([
      'Chicken bowls',
      'Miso soup',
      'Finish together',
    ]);
    expect(sections[0]!.steps.map((step) => step.text)).toEqual(['Cook the Chicken bowls.']);
    expect(sections[2]!.steps[0]!.text).toBe('Cool everything, then pack and label');
    expect(prepSections([], sig, null, new Map())).toEqual([]);
  });

  it('has step keys that change with the plan, so a changed plan starts unticked', () => {
    const a = prepSections(dishes, sig, answer, aliases)[0]!.steps[0]!.key;
    const b = prepSections(dishes, 'other', answer, aliases)[0]!.steps[0]!.key;
    expect(a).not.toBe(b);
  });

  it('says how long a dish keeps', () => {
    expect(keepsLine(0)).toBe('Eat it the day it is cooked');
    expect(keepsLine(1)).toBe('Keeps 1 day');
    expect(keepsLine(4)).toBe('Keeps 4 days');
  });
});
