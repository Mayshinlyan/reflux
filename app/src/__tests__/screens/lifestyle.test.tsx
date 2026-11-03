import { fireEvent, render, screen } from '@testing-library/react-native';

import LifestyleScreen from '@/app/lifestyle';
import { createTestDb } from '@/db/__tests__/testDb';
import { createSavedSymptom, listSavedSymptoms } from '@/db/repositories/savedSymptoms';
import { createSymptomLog, listSymptomLogs } from '@/db/repositories/symptoms';
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
const lifestyleNames = () => listSavedSymptoms(mockDb, 'lifestyle').map((row) => row.name);

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
});
afterEach(() => {
  jest.restoreAllMocks();
  closeDb();
});

describe('Lifestyle factors', () => {
  it('lists only the lifestyle factors you added, A to Z, with no instruction line', async () => {
    createSavedSymptom(mockDb, 'Late night snack', 'lifestyle');
    createSavedSymptom(mockDb, 'Coffee after dinner', 'lifestyle');
    createSavedSymptom(mockDb, 'Jaw tightness'); // a symptom: it lives on Usual symptoms
    await render(<LifestyleScreen />);

    expect(screen.getByRole('header', { name: 'Lifestyle factors' })).toBeTruthy();
    expect(
      screen
        .getAllByRole('button')
        .map((button) => button.props.accessibilityLabel as string)
        .filter((label) => ['Late night snack', 'Coffee after dinner', 'Jaw tightness'].includes(label)),
    ).toEqual(['Coffee after dinner', 'Late night snack']);
    expect(screen.queryByText('Swipe left to remove one.')).toBeNull();
    expect(screen.queryByText('Lifestyle factors', { exact: true })).toBeTruthy(); // only the title
  });

  it('says so in a few words when empty, with Add a lifestyle factor at the bottom', async () => {
    await render(<LifestyleScreen />);

    expect(screen.getByText('No lifestyle factors yet.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a lifestyle factor' })).toBeTruthy();
  });

  it('opens one to remove it, and entries already logged keep it', async () => {
    createSavedSymptom(mockDb, 'Skipped breakfast', 'lifestyle');
    createSavedSymptom(mockDb, 'Late night snack', 'lifestyle');
    createSymptomLog(mockDb, { items: [], tags: ['custom:Skipped breakfast'] });
    await render(<LifestyleScreen />);

    await press('Skipped breakfast');
    await press('Remove');

    expect(lifestyleNames()).toEqual(['Late night snack']);
    expect(screen.queryByRole('button', { name: 'Skipped breakfast' })).toBeNull();
    const logs = listSymptomLogs(mockDb, {
      from: '2000-01-01T00:00:00.000Z',
      to: '2100-01-01T00:00:00.000Z',
    });
    expect(logs[0]?.tags).toEqual(['custom:Skipped breakfast']);
  });
});

describe('Lifestyle factors: Add a lifestyle factor', () => {
  it('waits for something typed, then adds it to the list and closes', async () => {
    await render(<LifestyleScreen />);
    await press('Add a lifestyle factor');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('Lifestyle factor'), '  Skipped   breakfast ');
    await press('Add');

    expect(lifestyleNames()).toEqual(['Skipped breakfast']);
    expect(screen.getByRole('button', { name: 'Skipped breakfast' })).toBeTruthy();
    expect(screen.queryByLabelText('Lifestyle factor')).toBeNull();
  });

  it('does not save a built-in chip twice, and says so', async () => {
    await render(<LifestyleScreen />);
    await press('Add a lifestyle factor');

    await fireEvent.changeText(screen.getByLabelText('Lifestyle factor'), 'stress');
    await press('Add');

    expect(screen.getByText('That one is already a chip.')).toBeTruthy();
    expect(lifestyleNames()).toEqual([]);
  });

  it('keeps one entry when the same name is added again', async () => {
    createSavedSymptom(mockDb, 'Skipped breakfast', 'lifestyle');
    await render(<LifestyleScreen />);
    await press('Add a lifestyle factor');

    await fireEvent.changeText(screen.getByLabelText('Lifestyle factor'), 'skipped breakfast');
    await press('Add');

    expect(lifestyleNames()).toEqual(['Skipped breakfast']);
  });
});
