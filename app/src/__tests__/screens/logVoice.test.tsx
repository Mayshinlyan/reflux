import { act, fireEvent, render, screen } from '@testing-library/react-native';

import LogVoiceScreen from '@/app/log/voice';
import { createTestDb } from '@/db/__tests__/testDb';
import { listDiaryFoodLogs } from '@/db/repositories/food';
import { listSymptomLogs } from '@/db/repositories/symptoms';
import type { AppDb } from '@/db/types';

let mockDb: AppDb;
let closeDb: () => void;
let mockParams: { date?: string; demo?: string } = {};
const mockReplace = jest.fn();
const mockChing = jest.fn();

jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => ({ settings: { checkInReminderMinutes: null, bedtime: null } }),
}));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('@/lib/ching', () => ({ playChing: () => mockChing() }));
jest.mock('@/services/pendingChecks', () => ({ checkPendingMeals: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: () => true,
    push: jest.fn(),
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}));

const ALL_TIME = { from: '2000-01-01T00:00:00.000Z', to: '2100-01-01T00:00:00.000Z' };

const press = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const advance = async (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

/** Lets the stand-in hear the whole sentence, taps Done, and waits for "Did I get that?". */
async function speakAndConfirm() {
  await render(<LogVoiceScreen />);
  await advance(4000);
  await press('Done');
  await advance(2000);
}

beforeEach(() => {
  jest.useFakeTimers();
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockParams = {};
  mockReplace.mockClear();
  mockChing.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
  closeDb();
});

describe('Log voice screen', () => {
  it('listens, shows what it heard, and saves the meal and the symptoms linked to it', async () => {
    await render(<LogVoiceScreen />);
    expect(screen.getByText("I'm listening")).toBeTruthy();

    await advance(4000);
    // The words are kept, not shown, while listening; the wave is what moves.
    expect(screen.queryByText(/I had pasta and a glass of wine/)).toBeNull();
    expect(screen.getByTestId('voice-wave', { includeHiddenElements: true })).toBeTruthy();

    await press('Done');
    expect(screen.getByText('Got it')).toBeTruthy();
    // They appear once listening has ended.
    expect(screen.getByText(/I had pasta and a glass of wine/)).toBeTruthy();
    await advance(2000);

    expect(screen.getByText('Did I get that?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pasta' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Glass of wine' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Heartburn' })).toBeTruthy();
    // Nothing is saved until Save.
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);

    await press('Save');

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(meal).toMatchObject({ mealName: 'Pasta, Glass of wine', overallVerdict: null });
    const [symptoms] = listSymptomLogs(mockDb, ALL_TIME);
    expect(symptoms?.items.map((item) => item.key)).toEqual(['heartburn']);
    expect(symptoms?.foodLogId).toBe(meal?.id);
    // One swap to the completion page for the meal, like every other log.
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/completion',
      params: { kind: 'meal', id: String(meal?.id) },
    });
  });

  it('fixes a symptom by typing, with the matching symptoms listed below', async () => {
    await speakAndConfirm();

    await press('Heartburn');
    expect(screen.getByText('Fix this symptom')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Symptom'), 'Bur');
    await press('Burping');
    await press('Update');
    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    expect(screen.getByRole('button', { name: 'Burping' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Heartburn' })).toBeNull();
  });

  it('hands symptoms on their own to a symptoms completion', async () => {
    await speakAndConfirm();
    for (const name of ['Pasta', 'Glass of wine']) {
      await press(name);
      await press('Remove this food');
      await act(async () => {
        jest.advanceTimersByTime(600);
      });
    }

    await press('Save');

    const [log] = listSymptomLogs(mockDb, ALL_TIME);
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/completion',
      params: { kind: 'symptoms', id: String(log?.id) },
    });
  });

  it('fixes a food by typing and can remove one', async () => {
    await speakAndConfirm();

    await press('Pasta');
    await fireEvent.changeText(screen.getByLabelText('Food'), 'Spaghetti');
    await press('Update');
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(screen.getByRole('button', { name: 'Spaghetti' })).toBeTruthy();

    await press('Glass of wine');
    await press('Remove this food');
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(screen.queryByRole('button', { name: 'Glass of wine' })).toBeNull();
  });

  it('will not save once everything is removed', async () => {
    await speakAndConfirm();
    for (const name of ['Pasta', 'Glass of wine']) {
      await press(name);
      await press('Remove this food');
      await act(async () => {
        jest.advanceTimersByTime(600);
      });
    }
    await press('Heartburn');
    await press('Remove this symptom');
    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    expect(screen.getByRole('button', { name: 'Save' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('ends the recording when the wave is tapped, the same as Done', async () => {
    await render(<LogVoiceScreen />);
    await advance(4000);

    await fireEvent.press(screen.getByTestId('voice-wave', { includeHiddenElements: true }));

    expect(screen.getByText('Got it')).toBeTruthy();
  });

  it('starts listening again from Talk again', async () => {
    await speakAndConfirm();

    await press('Talk again');

    expect(screen.getByText("I'm listening")).toBeTruthy();
  });

  it('opens the typing screen from Type instead', async () => {
    await render(<LogVoiceScreen />);

    await press('Type instead');

    expect(mockReplace).toHaveBeenCalledWith('/log/food');
  });

  it('says the mic is off', async () => {
    mockParams = { demo: 'permission' };
    await render(<LogVoiceScreen />);
    await advance(10);

    expect(screen.getByText('Mic is off')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeTruthy();
  });

  it("says it didn't catch anything, and Talk again listens once more", async () => {
    mockParams = { demo: 'nothing' };
    await render(<LogVoiceScreen />);
    await advance(1000);
    await press('Done');

    expect(screen.getByText("Didn't catch that")).toBeTruthy();
    await press('Talk again');
    expect(screen.getByText("I'm listening")).toBeTruthy();
  });

  it('says there is no signal, and Try again works the same words out again', async () => {
    mockParams = { demo: 'offline' };
    await render(<LogVoiceScreen />);
    await advance(4000);
    await press('Done');
    await advance(2000);

    expect(screen.getByText('No signal')).toBeTruthy();
    await press('Try again');
    expect(screen.getByText('Got it')).toBeTruthy();
  });
});
