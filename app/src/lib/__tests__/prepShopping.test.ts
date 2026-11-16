import type { StoredMeal } from '@/db/repositories/mealPlans';
import type { PlanDish } from '@/types/mealPlan';

import { aboutHours, prepDay, prepDayName, prepDishes, prepSummary, storingLines } from '../prep';
import { aisleOf, buildShoppingList, parseIngredient, shoppingSummary, shoppingText } from '../shopping';

const dish = (id: string, title: string, over: Partial<PlanDish> = {}): PlanDish => ({
  id,
  title,
  minutes: 30,
  serves: 2,
  why: 'Gentle.',
  tip: '',
  keepsDays: 4,
  ingredients: [],
  steps: ['Cook it.'],
  ...over,
});

let nextId = 1;
const meal = (day: string, d: PlanDish, over: Partial<StoredMeal> = {}): StoredMeal => ({
  id: nextId++,
  day,
  slot: 'dinner',
  dishId: d.id,
  dish: d,
  locked: false,
  skipped: false,
  loggedAt: null,
  ...over,
});

describe('prep day', () => {
  const bowls = dish('a', 'Chicken bowls', { minutes: 45, steps: ['Poach the chicken.', 'Shred it.'] });
  const congee = dish('b', 'Congee', { minutes: 75, keepsDays: 1, steps: ['Simmer the base.'] });

  it('lists each dish once, longest first, with the meals eaten from it', () => {
    const meals = [
      meal('2026-11-16', bowls),
      meal('2026-11-17', bowls),
      meal('2026-11-18', congee),
      meal('2026-11-19', congee, { skipped: true }),
    ];
    const dishes = prepDishes(meals);

    expect(dishes.map((entry) => entry.dish.title)).toEqual(['Congee', 'Chicken bowls']);
    expect(dishes[0]!.meals).toHaveLength(1);
    expect(dishes[1]!.meals).toHaveLength(2);
  });

  it('cooks on the chosen weekday: Sunday unless another was picked, Saturday and Sunday before the week', () => {
    expect(prepDay('2026-11-16')).toBe('2026-11-15');
    expect(prepDay('2026-11-16', undefined, 0)).toBe('2026-11-15');
    expect(prepDay('2026-11-16', undefined, 6)).toBe('2026-11-14');
    expect(prepDayName('2026-11-15')).toBe('Sunday');
  });

  it('cooks inside the week when a weekday from Monday to Friday is chosen', () => {
    expect(prepDay('2026-11-16', undefined, 1)).toBe('2026-11-16');
    expect(prepDay('2026-11-16', undefined, 4)).toBe('2026-11-19');
    expect(prepDayName('2026-11-19')).toBe('Thursday');
  });

  it('puts a dish in the fridge while it keeps and in the freezer after', () => {
    const dishes = prepDishes([
      meal('2026-11-16', bowls),
      meal('2026-11-19', bowls),
      meal('2026-11-16', congee),
      meal('2026-11-18', congee),
    ]);

    expect(storingLines(dishes, '2026-11-15')).toEqual(['Fridge: Chicken bowls.', 'Freezer: Congee.']);
  });

  it('leaves out days that are already gone', () => {
    const meals = [meal('2026-11-16', bowls), meal('2026-11-18', congee)];

    expect(prepDishes(meals, '2026-11-17').map((entry) => entry.dish.title)).toEqual(['Congee']);
    // The chosen day (Sunday) has passed, so the cooking is today.
    expect(prepDay('2026-11-16', '2026-11-17')).toBe('2026-11-17');
    // A chosen day still to come is kept.
    expect(prepDay('2026-11-16', '2026-11-17', 4)).toBe('2026-11-19');
  });

  it('says about how long it takes', () => {
    expect(aboutHours(60)).toBe('about 1 hour');
    expect(aboutHours(120)).toBe('about 2 hours');
    expect(aboutHours(150)).toBe('about 2.5 hours');
    expect(prepSummary(prepDishes([meal('2026-11-16', bowls)]), 120)).toBe('1 dish, about 2 hours');
  });
});

describe('reading an ingredient line', () => {
  it('reads amounts, fractions, units and the name', () => {
    expect(parseIngredient('2 cups cooked rice')).toEqual({ name: 'rice', qty: 2, unit: 'cup' });
    expect(parseIngredient('1 1/2 lb chicken thighs (about 4)')).toEqual({
      name: 'chicken thighs',
      qty: 1.5,
      unit: 'lb',
    });
    expect(parseIngredient('½ tsp salt, to taste')).toEqual({ name: 'salt', qty: 0.5, unit: 'tsp' });
    expect(parseIngredient('4 carrots, sliced')).toEqual({ name: 'carrots', qty: 4, unit: null });
    expect(parseIngredient('2-3 tbsp olive oil')).toEqual({ name: 'olive oil', qty: 3, unit: 'tbsp' });
    expect(parseIngredient('fresh basil')).toEqual({ name: 'basil', qty: null, unit: null });
  });

  it('puts things in an aisle by their words', () => {
    expect(aisleOf('carrots')).toBe('Produce');
    expect(aisleOf('chicken thighs')).toBe('Protein');
    expect(aisleOf('eggs')).toBe('Dairy and eggs');
    expect(aisleOf('chicken broth')).toBe('Pantry');
    expect(aisleOf('tomato paste')).toBe('Pantry');
    expect(aisleOf('rice')).toBe('Pantry');
  });
});

describe('shopping list', () => {
  const bowls = dish('a', 'Chicken bowls', {
    ingredients: [
      '2 cups cooked rice',
      '1 lb chicken thighs',
      '4 carrots',
      '2 zucchini',
      'salt',
      '1 tbsp olive oil',
    ],
  });

  it('adds up what the meals need, sets aside the fridge and pantry basics, and groups by aisle', () => {
    // Four meals from a dish that serves two: cooked twice.
    const meals = ['16', '17', '18', '19'].map((d) => meal(`2026-11-${d}`, bowls));
    const list = buildShoppingList(meals, ['Carrots']);

    expect(list.aisles.map((aisle) => aisle.name)).toEqual(['Produce', 'Protein', 'Pantry']);
    expect(list.aisles[0]!.items).toEqual([{ key: 'zucchini', name: 'Zucchini', amount: '4' }]);
    expect(list.aisles[1]!.items[0]).toMatchObject({ name: 'Chicken thighs', amount: '2 lb' });
    expect(list.aisles[2]!.items[0]).toMatchObject({ name: 'Rice', amount: '1 bag' });
    expect(list.have).toEqual(['Carrots', 'Olive oil', 'Salt']);
    expect(list.toBuy).toBe(3);
    expect(shoppingSummary(list)).toBe('3 to buy, 3 you already have');
  });

  it('leaves out meals that are eaten out', () => {
    const list = buildShoppingList([meal('2026-11-16', bowls, { skipped: true })], []);
    expect(list.toBuy).toBe(0);
    expect(shoppingSummary(list)).toBe('Nothing to buy');
  });

  it('does not shop for days that are gone', () => {
    const list = buildShoppingList([meal('2026-11-16', bowls)], [], [], '2026-11-17');
    expect(list.toBuy).toBe(0);
  });

  it('does not take chicken in the fridge for chicken broth', () => {
    const soup = dish('s', 'Soup', { ingredients: ['2 cups chicken broth', '1 lb chicken thighs'] });
    const list = buildShoppingList([meal('2026-11-16', soup)], ['Chicken']);

    expect(list.aisles.flatMap((aisle) => aisle.items.map((item) => item.name))).toEqual(['Chicken broth']);
    expect(list.have).toEqual(['Chicken thighs']);
  });

  it('lists what can be bought, not what the recipe uses', () => {
    const lines = [
      '2 tbsp chopped cilantro',
      '2 tbsp thin ginger matchsticks',
      '3 tbsp fish sauce',
      '1 tsp fish sauce',
      '3 eggs',
      '3 cloves garlic, minced',
      '6 cups chicken broth',
      '1.2 lb salmon fillets',
      '2 cans chickpeas',
      '1 tsp ground cumin',
      '2 tbsp miso paste',
      '1 cup rice',
      '2 tbsp rice',
    ];
    const list = buildShoppingList([meal('2026-11-16', dish('x', 'Everything', { ingredients: lines }))], []);
    const amounts = Object.fromEntries(
      list.aisles.flatMap((aisle) => aisle.items.map((item) => [item.name, item.amount])),
    );

    expect(amounts).toMatchObject({
      Cilantro: '1 bunch',
      Ginger: '1 piece',
      'Fish sauce': '1 bottle',
      Eggs: '1 dozen',
      Garlic: '1 head',
      'Chicken broth': '2 cartons',
      'Salmon fillets': '1.5 lb',
      Chickpeas: '2 cans',
      'Ground cumin': '1 jar',
      'Miso paste': '1 jar',
      Rice: '1 bag',
    });
  });

  it('does not mistake one ingredient for another', () => {
    const lines = [
      '8 oz egg noodles',
      '1 tsp garlic powder',
      '1 tsp ground ginger',
      '2 tbsp ginger paste',
      '3 heads garlic',
      '1 lb italian sausage',
      '1 tsp peppermint extract',
      '1 cup steel cut oats',
      '4 slices thick cut bacon',
      '4 sprigs thyme',
      '1 package rice noodles',
      '1/2 cup tahini',
      '1/2 cup greek yogurt',
      '1/4 cup cilantro leaves',
      '1/2 lb tofu',
      '1 eggplant',
      '1 cup coconut milk',
      '1 cup almond butter',
      '2 cups lemon juice',
    ];
    const list = buildShoppingList([meal('2026-11-16', dish('y', 'Odds', { ingredients: lines }))], []);
    const amounts = Object.fromEntries(
      list.aisles.flatMap((aisle) => aisle.items.map((item) => [item.name, item.amount])),
    );

    expect(amounts).toMatchObject({
      'Egg noodles': '1 pack',
      'Garlic powder': '1 jar',
      'Ground ginger': '1 jar',
      'Ginger paste': '1 jar',
      Garlic: '3 heads',
      'Italian sausage': '1 lb',
      'Peppermint extract': '1 bottle',
      'Steel cut oats': '1 bag',
      Bacon: '1 pack',
      Thyme: '1 bunch',
      'Rice noodles': '1 pack',
      Tahini: '1 jar',
      'Greek yogurt': '1 tub',
      Cilantro: '1 bunch',
      Tofu: '1 block',
      Eggplant: '1',
      'Coconut milk': '1 can',
      'Almond butter': '1 jar',
      'Lemon juice': '1 bottle',
    });
  });

  it('puts compound foods in the right aisle and reads unit words and "juice of"', () => {
    expect(aisleOf('pineapple')).toBe('Produce');
    expect(aisleOf('watermelon')).toBe('Produce');
    expect(aisleOf('arugula')).toBe('Produce');
    expect(aisleOf('prosciutto')).toBe('Protein');
    expect(aisleOf('peanut butter')).toBe('Pantry');

    const lines = [
      '1 inch piece ginger',
      '1 pint cherry tomatoes',
      'juice of 1 lemon',
      '1 spaghetti squash',
      '1 cup spaghetti sauce',
      '4 oz cream cheese',
    ];
    const list = buildShoppingList([meal('2026-11-16', dish('z', 'More', { ingredients: lines }))], []);
    const amounts = Object.fromEntries(
      list.aisles.flatMap((aisle) => aisle.items.map((item) => [item.name, item.amount])),
    );
    expect(amounts).toMatchObject({
      Ginger: '1 piece',
      'Cherry tomatoes': '1',
      Lemon: '1',
      'Spaghetti squash': '1',
      'Spaghetti sauce': '1 bottle',
      'Cream cheese': '1 pack',
    });
  });

  it('adds what was typed in, and leaves ticked things out of the shared text', () => {
    const list = buildShoppingList([meal('2026-11-16', bowls)], [], ['Dish soap']);

    expect(list.aisles.at(-1)).toEqual({
      name: 'Added by you',
      items: [{ key: 'own:Dish soap', name: 'Dish soap', amount: '' }],
    });
    const text = shoppingText(list, new Set(['zucchini', 'own:Dish soap']));
    expect(text).not.toContain('Zucchini');
    expect(text).not.toContain('Dish soap');
    expect(text).toContain('Protein\n- Chicken thighs (1 lb)');
  });
});
