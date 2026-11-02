import { avoidFoods, savedRecipes } from '../schema';
import {
  createAvoidFood,
  listAvoidFoods,
  MAX_AVOID_FOODS,
  removeAvoidFood,
} from '../repositories/avoidFoods';
import { deleteAllData } from '../repositories/data';
import {
  findSavedRecipe,
  getSavedRecipe,
  listSavedRecipes,
  removeSavedRecipe,
  saveRecipe,
  setRecipeRating,
  updateSavedRecipe,
} from '../repositories/savedRecipes';
import { DEFAULT_SETTINGS, getAllSettings, getSetting, setSetting } from '../repositories/settings';
import type { Recipe } from '@/types/recipe';
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

const recipe: Recipe = {
  title: 'Kimchi egg fried rice',
  minutes: 20,
  serves: 2,
  why: 'Soft rice and egg are easy on the stomach.',
  tip: 'Eat it warm.',
  ingredients: ['1 1/2 cups cooked rice', '2 eggs'],
  steps: ['Chop the kimchi.', 'Stir-fry it.'],
};

describe('I don’t eat', () => {
  it('adds a tidied name and lists them A to Z', () => {
    createAvoidFood(db, '  Raw   onion ');
    createAvoidFood(db, 'peanuts');
    createAvoidFood(db, 'Pork');

    expect(listAvoidFoods(db).map((row) => row.name)).toEqual(['peanuts', 'Pork', 'Raw onion']);
  });

  it('keeps one row per name, ignoring capitals, and returns the one already saved', () => {
    const first = createAvoidFood(db, 'Pork');
    const again = createAvoidFood(db, 'pork');

    expect(again).toEqual(first);
    expect(listAvoidFoods(db)).toHaveLength(1);
  });

  it('refuses a blank name, cuts a long one to 40 characters and drops angle brackets', () => {
    expect(() => createAvoidFood(db, '   ')).toThrow('needs a name');
    expect(() => createAvoidFood(db, '<>')).toThrow('needs a name');
    expect(createAvoidFood(db, 'x'.repeat(60)).name).toHaveLength(40);
    expect(createAvoidFood(db, 'pea<nuts>').name).toBe('peanuts');
  });

  it('stops at the most the recipe service takes', () => {
    for (let i = 0; i < MAX_AVOID_FOODS; i += 1) createAvoidFood(db, `food ${i}`);

    expect(() => createAvoidFood(db, 'one more')).toThrow('full');
    // A name already there is still fine.
    expect(() => createAvoidFood(db, 'FOOD 3')).not.toThrow();
  });

  it('removes one and leaves the rest', () => {
    const pork = createAvoidFood(db, 'Pork');
    createAvoidFood(db, 'Peanuts');

    removeAvoidFood(db, pork.id);

    expect(listAvoidFoods(db).map((row) => row.name)).toEqual(['Peanuts']);
  });
});

describe('saved recipes', () => {
  it('saves a recipe and reads it back whole, newest first', () => {
    const first = saveRecipe(db, recipe, 'korean');
    const second = saveRecipe(db, { ...recipe, title: 'Miso salmon bowl' }, 'japanese');

    expect(first.recipe).toEqual(recipe);
    expect(first.cuisine).toBe('korean');
    expect(listSavedRecipes(db).map((item) => item.id)).toEqual([second.id, first.id]);
    expect(getSavedRecipe(db, first.id)?.recipe.steps).toEqual(['Chop the kimchi.', 'Stir-fry it.']);
  });

  it('saves only the fields it shows', () => {
    const stored = saveRecipe(db, { ...recipe, calories: 400 } as Recipe, 'korean');

    expect(Object.keys(stored.recipe).sort()).toEqual(
      ['ingredients', 'minutes', 'serves', 'steps', 'tip', 'title', 'why'].sort(),
    );
  });

  it('keeps the picture it was shown with, so a saved recipe looks the same on the list', () => {
    const stored = saveRecipe(db, { ...recipe, look: 3 }, 'korean');

    expect(stored.recipe.look).toBe(3);
    expect(getSavedRecipe(db, stored.id)?.recipe.look).toBe(3);
  });

  it('skips a row whose stored look is not one of the five', () => {
    db.insert(savedRecipes)
      .values({ title: 'Odd look', cuisine: 'korean', minutes: 5, serves: 1, recipe: { ...recipe, look: 9 } })
      .run();

    expect(listSavedRecipes(db)).toHaveLength(0);
  });

  it('saving the same dish again (same name and cuisine) returns the one already saved', () => {
    const first = saveRecipe(db, recipe, 'korean');
    const again = saveRecipe(db, recipe, 'korean');
    const other = saveRecipe(db, recipe, 'japanese');

    expect(again.id).toBe(first.id);
    expect(other.id).not.toBe(first.id);
    expect(listSavedRecipes(db)).toHaveLength(2);
    expect(findSavedRecipe(db, recipe.title, 'korean')?.id).toBe(first.id);
    expect(findSavedRecipe(db, 'Something else', 'korean')).toBeNull();
  });

  it('rates a recipe, takes the rating back, and removes it', () => {
    const saved = saveRecipe(db, recipe, 'korean');

    setRecipeRating(db, saved.id, 'up');
    expect(getSavedRecipe(db, saved.id)?.rating).toBe('up');
    setRecipeRating(db, saved.id, null);
    expect(getSavedRecipe(db, saved.id)?.rating).toBeNull();

    removeSavedRecipe(db, saved.id);
    expect(getSavedRecipe(db, saved.id)).toBeNull();
  });

  it('puts an edited version in a saved recipe’s place and keeps its rating', () => {
    const saved = saveRecipe(db, recipe, 'korean');
    setRecipeRating(db, saved.id, 'up');

    updateSavedRecipe(db, saved.id, {
      ...recipe,
      title: 'Spinach egg fried rice',
      ingredients: ['1 cup rice', 'spinach'],
    });

    const stored = getSavedRecipe(db, saved.id);
    expect(stored?.recipe.title).toBe('Spinach egg fried rice');
    expect(stored?.recipe.ingredients).toEqual(['1 cup rice', 'spinach']);
    expect(stored?.rating).toBe('up');
    expect(listSavedRecipes(db)).toHaveLength(1);
  });

  it('skips a row whose stored recipe has the wrong shape instead of crashing', () => {
    saveRecipe(db, recipe, 'korean');
    db.insert(savedRecipes)
      .values({ title: 'Broken', cuisine: 'korean', minutes: 5, serves: 1, recipe: { nope: true } })
      .run();

    expect(listSavedRecipes(db).map((item) => item.recipe.title)).toEqual(['Kimchi egg fried rice']);
  });

  it('shows an unknown cuisine as Any', () => {
    db.insert(savedRecipes).values({ title: 'Odd', cuisine: 'martian', minutes: 5, serves: 1, recipe }).run();

    expect(listSavedRecipes(db)[0]?.cuisine).toBe('any');
  });
});

describe('Delete all my data', () => {
  it('also clears saved recipes and the I don’t eat list', () => {
    saveRecipe(db, recipe, 'korean');
    createAvoidFood(db, 'Pork');
    setSetting(db, 'kitchenServes', 4);
    setSetting(db, 'kitchenIdeas', { cuisine: 'korean', recipes: [recipe] });

    deleteAllData(db);

    expect(getSetting(db, 'kitchenIdeas')).toBeNull();

    expect(db.select().from(savedRecipes).all()).toHaveLength(0);
    expect(db.select().from(avoidFoods).all()).toHaveLength(0);
    expect(getSetting(db, 'kitchenServes')).toBe(DEFAULT_SETTINGS.kitchenServes);
  });
});

describe('Kitchen settings', () => {
  it('start as Any, 40 minutes, 2 servings and no rounds', () => {
    expect(getAllSettings(db)).toMatchObject({
      kitchenCuisine: 'any',
      kitchenTime: '40',
      kitchenServes: 2,
      kitchenRounds: { day: '', count: 0 },
      kitchenIdeas: null,
    });
  });

  it('keep the last round of ideas, and refuse a round that is not recipes', () => {
    const ideas = { cuisine: 'korean' as const, recipes: [recipe] };
    setSetting(db, 'kitchenIdeas', ideas);
    expect(getSetting(db, 'kitchenIdeas')).toEqual(ideas);
    setSetting(db, 'kitchenIdeas', null);
    expect(getSetting(db, 'kitchenIdeas')).toBeNull();

    expect(() => setSetting(db, 'kitchenIdeas', { cuisine: 'martian', recipes: [] } as never)).toThrow();
    expect(() =>
      setSetting(db, 'kitchenIdeas', { cuisine: 'korean', recipes: [{ title: 'x' }] } as never),
    ).toThrow();
  });

  it('save the last choices and the day’s rounds', () => {
    setSetting(db, 'kitchenCuisine', 'thai');
    setSetting(db, 'kitchenTime', 'long');
    setSetting(db, 'kitchenServes', 5);
    setSetting(db, 'kitchenRounds', { day: '2026-11-02', count: 3 });

    expect(getAllSettings(db)).toMatchObject({
      kitchenCuisine: 'thai',
      kitchenTime: 'long',
      kitchenServes: 5,
      kitchenRounds: { day: '2026-11-02', count: 3 },
    });
  });

  it.each([
    ['an unknown cuisine', 'kitchenCuisine', 'martian'],
    ['an unknown time', 'kitchenTime', '5'],
    ['zero servings', 'kitchenServes', 0],
    ['seven servings', 'kitchenServes', 7],
    ['a fractional serving count', 'kitchenServes', 1.5],
    ['a negative round count', 'kitchenRounds', { day: '2026-11-02', count: -1 }],
    ['rounds without a day', 'kitchenRounds', { count: 1 }],
  ])('refuse %s', (_name, key, value) => {
    expect(() => setSetting(db, key as 'kitchenServes', value as never)).toThrow();
  });
});
