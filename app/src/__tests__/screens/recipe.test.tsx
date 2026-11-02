import { fireEvent, render, screen } from '@testing-library/react-native';

import RecipeScreen from '@/app/recipe';
import { createTestDb } from '@/db/__tests__/testDb';
import { getSavedRecipe, listSavedRecipes, saveRecipe } from '@/db/repositories/savedRecipes';
import type { AppDb } from '@/db/types';
import { setRecipeDraft } from '@/lib/recipeDraft';
import type { Recipe } from '@/types/recipe';

let mockDb: AppDb;
let closeDb: () => void;
let mockParams: { saved?: string } = {};
const mockPush = jest.fn();

jest.mock('@/db/DatabaseProvider', () => ({ useDb: () => mockDb }));
// Sentry's SDK starts a cleanup timer on import; not needed here.
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// Reanimated's native runtime can't load in Jest; use its mocks (which lack useReducedMotion).
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
jest.mock('expo-router', () => ({
  router: {
    push: (href: unknown) => mockPush(href),
    back: jest.fn(),
    canGoBack: () => true,
    replace: jest.fn(),
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));

const recipe: Recipe = {
  title: 'Kimchi egg fried rice',
  minutes: 20,
  serves: 2,
  why: 'Soft rice and egg are easy on the stomach.',
  tip: 'Eat it warm, not hot.',
  ingredients: ['1 1/2 cups cooked rice', '2 eggs', '1 tbsp sesame oil'],
  steps: ['Chop the kimchi.', 'Stir-fry it in the oil.', 'Add the rice, then the eggs.'],
};

const press = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockParams = {};
  mockPush.mockClear();
  setRecipeDraft({ recipe, cuisine: 'korean' });
});
afterEach(() => {
  setRecipeDraft(null);
  closeDb();
});

describe('Recipe', () => {
  it('shows the dish, why it is gentle, the ingredients and the steps', async () => {
    await render(<RecipeScreen />);

    expect(screen.getByRole('header', { name: 'Kimchi egg fried rice' })).toBeTruthy();
    expect(screen.getByText('20 min · serves 2')).toBeTruthy();
    expect(screen.getByText('Gentle')).toBeTruthy();
    expect(screen.getByText("Why it's gentle")).toBeTruthy();
    expect(screen.getByText('Soft rice and egg are easy on the stomach.')).toBeTruthy();
    expect(screen.getByText('Belly tip')).toBeTruthy();
    expect(screen.getByText('Eat it warm, not hot.')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Ingredients' })).toBeTruthy();
    expect(screen.getByText('for 2')).toBeTruthy();
    for (const item of recipe.ingredients) expect(screen.getByText(item)).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Steps' })).toBeTruthy();
    for (const step of recipe.steps) expect(screen.getByText(step)).toBeTruthy();
    expect(screen.getByText('Ideas, not medical advice.')).toBeTruthy();
  });

  it('leaves out the tip when there is none', async () => {
    setRecipeDraft({ recipe: { ...recipe, tip: '' }, cuisine: 'korean' });
    await render(<RecipeScreen />);

    expect(screen.queryByText('Belly tip')).toBeNull();
  });

  it('says so when there is nothing to show, instead of crashing', async () => {
    setRecipeDraft(null);
    await render(<RecipeScreen />);

    expect(screen.getByText('That recipe is gone')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('opens a saved recipe by its id', async () => {
    setRecipeDraft(null);
    const saved = saveRecipe(mockDb, { ...recipe, title: 'Miso salmon bowl' }, 'japanese');
    mockParams = { saved: String(saved.id) };
    await render(<RecipeScreen />);

    expect(screen.getByRole('header', { name: 'Miso salmon bowl' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Saved' })).toBeTruthy();
  });

  it('says a saved id that is gone is gone', async () => {
    mockParams = { saved: '999' };
    await render(<RecipeScreen />);

    expect(screen.getByText('That recipe is gone')).toBeTruthy();
  });
});

describe('Recipe: save and log', () => {
  it('saves it, and a second tap takes it off the list again', async () => {
    await render(<RecipeScreen />);

    await press('Save');
    expect(listSavedRecipes(mockDb).map((item) => item.recipe.title)).toEqual(['Kimchi egg fried rice']);
    expect(screen.getByRole('button', { name: 'Saved' })).toBeTruthy();

    await press('Saved');
    expect(listSavedRecipes(mockDb)).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('shows a recipe that was saved before as already saved', async () => {
    saveRecipe(mockDb, recipe, 'korean');
    await render(<RecipeScreen />);

    expect(screen.getByRole('button', { name: 'Saved' })).toBeTruthy();
    expect(listSavedRecipes(mockDb)).toHaveLength(1);
  });

  it('opens Log food with the dish typed in, for Log this meal', async () => {
    await render(<RecipeScreen />);

    await press('Log this meal');

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/log/food',
      params: { prefill: 'Kimchi egg fried rice' },
    });
  });
});

describe('Recipe: how was it', () => {
  it('only asks once the recipe is saved', async () => {
    await render(<RecipeScreen />);
    expect(screen.queryByText('How was it?')).toBeNull();

    await press('Save');

    expect(screen.getByText('How was it?')).toBeTruthy();
  });

  it('keeps a thumb, switches it, and takes it back with a second tap', async () => {
    const saved = saveRecipe(mockDb, recipe, 'korean');
    await render(<RecipeScreen />);

    await press('Liked it');
    expect(getSavedRecipe(mockDb, saved.id)?.rating).toBe('up');
    expect(screen.getByRole('button', { name: 'Liked it' }).props.accessibilityState).toMatchObject({
      selected: true,
    });

    await press('Not for me');
    expect(getSavedRecipe(mockDb, saved.id)?.rating).toBe('down');

    await press('Not for me');
    expect(getSavedRecipe(mockDb, saved.id)?.rating).toBeNull();
  });
});
