import { fireEvent, render, screen } from '@testing-library/react-native';

import AvoidFoodsScreen from '@/app/avoid-foods';
import { createTestDb } from '@/db/__tests__/testDb';
import { createAvoidFood, listAvoidFoods, MAX_AVOID_FOODS } from '@/db/repositories/avoidFoods';
import type { AppDb } from '@/db/types';

let mockDb: AppDb;
let closeDb: () => void;

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
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
  useFocusEffect: (effect: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, [effect]);
  },
}));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));

const press = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const names = () => listAvoidFoods(mockDb).map((row) => row.name);

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
});
afterEach(() => {
  jest.restoreAllMocks();
  closeDb();
});

describe("I don't eat", () => {
  it('lists the foods A to Z, laid out like the other lists', async () => {
    createAvoidFood(mockDb, 'Raw onion');
    createAvoidFood(mockDb, 'Peanuts');
    createAvoidFood(mockDb, 'Pork');
    await render(<AvoidFoodsScreen />);

    expect(screen.getByRole('header', { name: "I don't eat" })).toBeTruthy();
    expect(
      screen
        .getAllByRole('button')
        .map((button) => button.props.accessibilityLabel as string)
        .filter((label) => ['Raw onion', 'Peanuts', 'Pork'].includes(label)),
    ).toEqual(['Peanuts', 'Pork', 'Raw onion']);
  });

  it('says what the list is for when empty, with Add a food at the bottom', async () => {
    await render(<AvoidFoodsScreen />);

    expect(screen.getByText(/the Kitchen will keep them out of every recipe/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a food' })).toBeTruthy();
  });

  it('opens one to remove it', async () => {
    createAvoidFood(mockDb, 'Pork');
    createAvoidFood(mockDb, 'Peanuts');
    await render(<AvoidFoodsScreen />);

    await press('Pork');
    await press('Remove');

    expect(names()).toEqual(['Peanuts']);
    expect(screen.queryByRole('button', { name: 'Pork' })).toBeNull();
  });
});

describe("I don't eat: Add a food", () => {
  it('waits for something typed, then adds it to the list and closes', async () => {
    await render(<AvoidFoodsScreen />);
    await press('Add a food');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText("Food you don't eat"), '  Raw   onion ');
    await press('Add');

    expect(names()).toEqual(['Raw onion']);
    expect(screen.getByRole('button', { name: 'Raw onion' })).toBeTruthy();
    expect(screen.queryByLabelText("Food you don't eat")).toBeNull();
  });

  it('keeps one entry when the same name is added again', async () => {
    createAvoidFood(mockDb, 'Pork');
    await render(<AvoidFoodsScreen />);
    await press('Add a food');

    await fireEvent.changeText(screen.getByLabelText("Food you don't eat"), 'pork');
    await press('Add');

    expect(names()).toEqual(['Pork']);
  });

  it('says so when the list is full, and adds nothing', async () => {
    for (let i = 0; i < MAX_AVOID_FOODS; i += 1) createAvoidFood(mockDb, `Food ${i}`);
    await render(<AvoidFoodsScreen />);
    await press('Add a food');

    await fireEvent.changeText(screen.getByLabelText("Food you don't eat"), 'One more');
    await press('Add');

    expect(screen.getByText(/the most we can keep/)).toBeTruthy();
    expect(names()).toHaveLength(MAX_AVOID_FOODS);
  });
});
