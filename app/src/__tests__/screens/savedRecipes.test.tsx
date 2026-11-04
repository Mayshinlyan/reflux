import { fireEvent, render, screen } from '@testing-library/react-native';

import SavedRecipesScreen from '@/app/saved-recipes';
import { createTestDb } from '@/db/__tests__/testDb';
import { saveRecipe } from '@/db/repositories/savedRecipes';
import type { AppDb } from '@/db/types';
import type { Recipe } from '@/types/recipe';

let mockDb: AppDb;
let closeDb: () => void;
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
  router: { push: (href: unknown) => mockPush(href), back: jest.fn(), canGoBack: () => true },
  useFocusEffect: (effect: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, [effect]);
  },
}));

const recipe = (title: string): Recipe => ({
  title,
  minutes: 20,
  serves: 2,
  why: `${title} is soft and mild.`,
  tip: '',
  ingredients: ['1 cup rice'],
  steps: ['Cook the rice.'],
});

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockPush.mockClear();
});
afterEach(() => closeDb());

describe('Saved recipes', () => {
  it('says there is nothing yet', async () => {
    await render(<SavedRecipesScreen />);

    expect(screen.getByRole('header', { name: 'Saved recipes' })).toBeTruthy();
    expect(screen.getByText('0 recipes')).toBeTruthy();
    expect(screen.getByText('Recipes you save will show up here.')).toBeTruthy();
  });

  it('lists every saved recipe, newest first, and opens one by its id', async () => {
    saveRecipe(mockDb, recipe('Kimchi egg fried rice'), 'korean');
    const second = saveRecipe(mockDb, recipe('Miso salmon bowl'), 'japanese');
    await render(<SavedRecipesScreen />);

    expect(screen.getByText('2 recipes')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Miso salmon bowl, 20 min · serves 2' }));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/recipe', params: { saved: String(second.id) } });
  });

  it('says "1 recipe" for a single one', async () => {
    saveRecipe(mockDb, recipe('Miso salmon bowl'), 'japanese');
    await render(<SavedRecipesScreen />);

    expect(screen.getByText('1 recipe')).toBeTruthy();
  });
});
