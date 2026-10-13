import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import MySymptomsScreen from '@/app/my-symptoms';
import { createTestDb } from '@/db/__tests__/testDb';
import { createSavedSymptom, listSavedSymptoms } from '@/db/repositories/savedSymptoms';
import { createSymptomLog, listSymptomLogs } from '@/db/repositories/symptoms';
import type { AppDb } from '@/db/types';

let mockDb: AppDb;
let closeDb: () => void;
const mockToast = jest.fn();

jest.mock('@/db/DatabaseProvider', () => ({ useDb: () => mockDb }));
// Sentry's SDK starts a cleanup timer on import; not needed here.
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('@/components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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
const pressAlertButton = (spy: jest.SpyInstance, text: string) => {
  const buttons = spy.mock.calls.at(-1)?.[2] as AlertButton[];
  buttons.find((button) => button.text === text)?.onPress?.();
};

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockToast.mockClear();
});
afterEach(() => {
  jest.restoreAllMocks();
  closeDb();
});

describe('My symptoms', () => {
  it('lists what you added, A to Z, with the swipe hint', async () => {
    createSavedSymptom(mockDb, 'Jaw tightness');
    createSavedSymptom(mockDb, 'Dry mouth');
    await render(<MySymptomsScreen />);

    expect(screen.getByRole('header', { name: 'My symptoms' })).toBeTruthy();
    expect(screen.getByText('Swipe left to remove one.')).toBeTruthy();
    expect(
      screen.getAllByLabelText(/^(Dry mouth|Jaw tightness)$/).map((el) => el.props.accessibilityLabel),
    ).toEqual(['Dry mouth', 'Jaw tightness']);
  });

  it('says what the list is for when it is empty', async () => {
    await render(<MySymptomsScreen />);
    expect(screen.getByText(/Symptoms you add with/)).toBeTruthy();
  });

  it('removes one from a left swipe after confirming, and entries already logged keep it', async () => {
    createSavedSymptom(mockDb, 'Hiccups');
    createSavedSymptom(mockDb, 'Dry mouth');
    createSymptomLog(mockDb, { items: [{ key: 'custom:Hiccups' }] });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<MySymptomsScreen />);

    await press('Delete Hiccups');
    expect(alert).toHaveBeenCalledWith('Remove Hiccups?', expect.any(String), expect.any(Array));
    await act(async () => pressAlertButton(alert, 'Remove'));

    expect(listSavedSymptoms(mockDb).map((row) => row.name)).toEqual(['Dry mouth']);
    expect(screen.queryByLabelText('Hiccups')).toBeNull();
    expect(mockToast).toHaveBeenCalledWith('Removed from your list');
    const logs = listSymptomLogs(mockDb, {
      from: '2000-01-01T00:00:00.000Z',
      to: '2100-01-01T00:00:00.000Z',
    });
    expect(logs[0]?.items).toEqual([{ key: 'custom:Hiccups', score: 1 }]);
  });

  it('keeps the symptom when the removal is cancelled', async () => {
    createSavedSymptom(mockDb, 'Hiccups');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<MySymptomsScreen />);

    await press('Delete Hiccups');
    await act(async () => pressAlertButton(alert, 'Cancel'));

    expect(listSavedSymptoms(mockDb)).toHaveLength(1);
  });

  it('offers Delete to screen readers, which cannot swipe', async () => {
    createSavedSymptom(mockDb, 'Hiccups');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<MySymptomsScreen />);

    await fireEvent(screen.getByLabelText('Hiccups'), 'accessibilityAction', {
      nativeEvent: { actionName: 'delete' },
    });

    expect(alert).toHaveBeenCalledWith('Remove Hiccups?', expect.any(String), expect.any(Array));
  });

  it('adds a symptom from the bottom button', async () => {
    await render(<MySymptomsScreen />);

    await press('Add a symptom');
    await fireEvent.changeText(screen.getByLabelText('Add your own symptom'), 'Hiccups');
    await press('Add');

    expect(listSavedSymptoms(mockDb).map((row) => row.name)).toEqual(['Hiccups']);
    expect(screen.getByLabelText('Hiccups')).toBeTruthy();
  });

  it('does not add a built-in symptom to the list, and says so', async () => {
    await render(<MySymptomsScreen />);

    await press('Add a symptom');
    await fireEvent.changeText(screen.getByLabelText('Add your own symptom'), 'heartburn');
    await press('Add');

    expect(listSavedSymptoms(mockDb)).toEqual([]);
    expect(mockToast).toHaveBeenCalled();
  });
});
