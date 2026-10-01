import type { MealAnalysis, MealItem, TriggerCategory } from '@/types/analysis';

import {
  formatIngredients,
  MAIN_INGREDIENT_LIMIT,
  mainIngredients,
  parseIngredients,
  withIngredients,
} from '../ingredients';

type Ingredient = MealItem['ingredients'][number];
const make = (name: string, matchedCategories: TriggerCategory[]): Ingredient => ({
  name,
  matchedCategories,
});
const plain = (name: string) => make(name, []);
const trigger = (name: string) => make(name, ['spicy']);
const names = (list: { name: string }[]) => list.map((i) => i.name);

describe('mainIngredients', () => {
  it('shows everything when the list is short', () => {
    const list = [plain('rice'), plain('egg')];
    expect(mainIngredients(list)).toEqual({ shown: list, hiddenCount: 0 });
  });

  it('caps a long list at the limit and reports how many are hidden', () => {
    const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(plain);
    const { shown, hiddenCount } = mainIngredients(list);
    expect(names(shown)).toEqual(['a', 'b', 'c', 'd']);
    expect(hiddenCount).toBe(3);
    expect(MAIN_INGREDIENT_LIMIT).toBe(4);
  });

  it('never hides an ingredient that matches a trigger, and keeps the original order', () => {
    const list = [plain('a'), plain('b'), plain('c'), plain('d'), plain('e'), trigger('chili'), plain('f')];
    const { shown, hiddenCount } = mainIngredients(list);
    // 1 trigger leaves room for 3 others; the trigger stays in its original place.
    expect(names(shown)).toEqual(['a', 'b', 'c', 'chili']);
    expect(hiddenCount).toBe(3);
  });

  it('shows all triggers even when they exceed the limit', () => {
    const list = ['t1', 't2', 't3', 't4', 't5', 't6'].map(trigger).concat(plain('salt'));
    const { shown, hiddenCount } = mainIngredients(list);
    expect(names(shown)).toEqual(['t1', 't2', 't3', 't4', 't5', 't6']);
    expect(hiddenCount).toBe(1);
  });

  it('handles an empty list', () => {
    expect(mainIngredients([])).toEqual({ shown: [], hiddenCount: 0 });
  });
});

describe('editing ingredients', () => {
  const meal: MealAnalysis = {
    isFood: true,
    mealName: 'Tea toast',
    items: [
      {
        name: 'Tea',
        ingredients: [make('Peppermint', ['mint']), plain('Water')],
        verdict: 'caution',
        reasoning: 'r',
        matchedTriggers: [{ category: 'mint', evidence: 'peppermint' }],
      },
      {
        name: 'Toast',
        ingredients: [plain('Bread'), plain('water')],
        verdict: 'ok',
        reasoning: 'r',
        matchedTriggers: [],
      },
    ],
    overall: { verdict: 'caution', confidence: 'high', reasoning: 'r' },
  };

  it('lists every ingredient once, as a comma line', () => {
    expect(formatIngredients(meal)).toBe('Peppermint, Water, Bread');
  });

  it('parses a typed line: trimmed, no blanks or repeats', () => {
    expect(parseIngredients(' oats, Banana ,, oats ,  ')).toEqual(['oats', 'Banana']);
    expect(parseIngredients('')).toEqual([]);
  });

  it('keeps the trigger tags of ingredients that stay, drops removed ones and adds new ones', () => {
    const edited = withIngredients(meal, ['peppermint', 'Honey']);
    expect(edited.items[0].ingredients).toEqual([make('Peppermint', ['mint']), make('Honey', [])]);
    expect(edited.items[1].ingredients).toEqual([]);
    expect(edited.overall).toEqual(meal.overall);
  });
});
