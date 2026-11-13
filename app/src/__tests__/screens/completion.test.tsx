import { fireEvent, render, screen } from '@testing-library/react-native';

import CompletionScreen from '@/app/completion';
import { createTestDb } from '@/db/__tests__/testDb';
import { createUncheckedMeal } from '@/db/repositories/food';
import { logMedication, createMedication } from '@/db/repositories/medications';
import { getAllSettings, getSetting, setSetting } from '@/db/repositories/settings';
import type { AppDb } from '@/db/types';

const mockGetAll = getAllSettings;
const mockSet = setSetting;
let mockDb: AppDb;
let closeDb: () => void;
let mockParams: { kind?: string; id?: string; note?: string } = {};
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => ({
    settings: mockGetAll(mockDb),
    update: (key: Parameters<typeof setSetting>[1], value: never) => mockSet(mockDb, key, value),
  }),
}));
jest.mock('expo-router', () => ({
  router: { back: () => mockBack(), replace: (...args: unknown[]) => mockReplace(...args) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  SafeAreaView: jest.requireActual('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const press = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockParams = {};
  mockBack.mockClear();
  mockReplace.mockClear();
});
afterEach(() => closeDb());

describe('Completion flow', () => {
  it('walks the first meal through completion, streak and a goal, then closes', async () => {
    const id = createUncheckedMeal(mockDb, { source: 'text', inputText: 'Oatmeal' });
    mockParams = { kind: 'meal', id: String(id) };
    await render(<CompletionScreen />);

    expect(screen.getByRole('header', { name: 'Meal logged' })).toBeTruthy();
    expect(screen.getByText('1 meal today')).toBeTruthy();
    await press('Continue');

    expect(screen.getByRole('header', { name: 'First check-in' })).toBeTruthy();
    await press('Continue');

    expect(screen.getByRole('header', { name: 'Commit to finding your pattern!' })).toBeTruthy();
    // The button waits for a pick.
    expect(screen.getByRole('button', { name: 'Commit to my goal' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await fireEvent.press(screen.getByRole('radio', { name: /14 check-in days/ }));
    await press('Commit to my goal');

    expect(getSetting(mockDb, 'commitGoal')).toBe(14);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('is only the completion for a later log the same day', async () => {
    createUncheckedMeal(mockDb, { source: 'text', inputText: 'Toast' });
    const id = createUncheckedMeal(mockDb, { source: 'text', inputText: 'Tea' });
    mockParams = { kind: 'meal', id: String(id) };
    await render(<CompletionScreen />);

    expect(screen.getByText('2 meals today')).toBeTruthy();
    await press('Continue');

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('offers Change time on a dose, which opens that dose to edit', async () => {
    const medId = createMedication(mockDb, { name: 'Metformin', type: 'other', defaultDose: '500mg' });
    const logId = logMedication(mockDb, medId, {});
    mockParams = { kind: 'dose', id: String(logId), note: 'Metformin, 8:30 AM' };
    await render(<CompletionScreen />);

    expect(screen.getByText('Metformin, 8:30 AM')).toBeTruthy();
    await press('Change time');

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/entry/edit',
      params: { kind: 'medication', id: String(logId) },
    });
  });
});
