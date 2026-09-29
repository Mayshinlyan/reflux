import { fireEvent, render, screen } from '@testing-library/react-native';

import { createTestDb } from '@/db/__tests__/testDb';
import { createSymptomLog, getSymptomLog, listSymptomLogs } from '@/db/repositories/symptoms';
import type { AppDb } from '@/db/types';

import LogSymptomsScreen from '@/app/log/symptoms';

let mockDb: AppDb;
let closeDb: () => void;
let mockParams: { id?: string } = {};
const mockBack = jest.fn();
const mockToast = jest.fn();

jest.mock('@/db/DatabaseProvider', () => ({ useDb: () => mockDb }));
// Sentry's SDK starts a cleanup timer on import; not needed here.
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('@/components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('expo-router', () => ({
  router: { back: () => mockBack(), canGoBack: () => true, replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));

const ALL_TIME = { from: '2000-01-01T00:00:00.000Z', to: '2100-01-01T00:00:00.000Z' };

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockParams = {};
  mockBack.mockClear();
  mockToast.mockClear();
});

afterEach(() => closeDb());

describe('Log symptoms screen', () => {
  it('saves two symptoms with severities and two tags', async () => {
    await render(<LogSymptomsScreen />);

    const save = screen.getByRole('button', { name: 'Save entry' });
    expect(save.props.accessibilityState).toMatchObject({ disabled: true });

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Heartburn' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Hoarse voice' }));
    // Raise heartburn from the default 3 to 4 (screen-reader path).
    await fireEvent(screen.getByRole('adjustable', { name: 'Heartburn' }), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Large meal' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Lay down after eating' }));
    await fireEvent.changeText(screen.getByLabelText('Note'), 'after dinner');

    await fireEvent.press(screen.getByRole('button', { name: 'Save entry' }));

    const [log] = listSymptomLogs(mockDb, ALL_TIME);
    expect(log?.items).toEqual([
      { key: 'hoarseness', score: 3 },
      { key: 'heartburn', score: 4 },
    ]);
    expect(log?.tags.sort()).toEqual(['large_meal', 'lay_down_after_eating']);
    expect(log?.notes).toBe('after dinner');
    expect(mockToast).toHaveBeenCalledWith('Symptoms logged');
    expect(mockBack).toHaveBeenCalled();
  });

  it('edits an existing entry in place', async () => {
    const id = createSymptomLog(mockDb, { items: [{ key: 'cough', score: 2 }], tags: ['stress'] });
    mockParams = { id: String(id) };
    await render(<LogSymptomsScreen />);

    expect(screen.getByText('Edit symptoms')).toBeTruthy();
    await fireEvent.press(screen.getByRole('adjustable', { name: 'Nagging cough' })); // deselect
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Excess mucus' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Stress' })); // untag
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));

    expect(listSymptomLogs(mockDb, ALL_TIME)).toHaveLength(1);
    expect(getSymptomLog(mockDb, id)).toMatchObject({ items: [{ key: 'mucus', score: 3 }], tags: [] });
    expect(mockToast).toHaveBeenCalledWith('Entry updated');
  });
});
