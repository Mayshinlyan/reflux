import type { MealItem, TriggerCategory } from '@/types/analysis';

import { MAIN_INGREDIENT_LIMIT, mainIngredients } from '../ingredients';

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
