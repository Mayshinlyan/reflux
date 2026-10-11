import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import HistoryScreen from '@/app/(tabs)/history';
import { createTestDb } from '@/db/__tests__/testDb';
import { createFoodLog, createUncheckedMeal, listDiaryFoodLogs } from '@/db/repositories/food';
import { createMedication, logMedication } from '@/db/repositories/medications';
import { createSymptomLog } from '@/db/repositories/symptoms';
import type { AppDb } from '@/db/types';
import type { Verdict } from '@/types/analysis';
import { router } from 'expo-router';

let mockDb: AppDb;
let closeDb: () => void;

jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => ({
    settings: { bedtime: '22:30', lateMealWindowMinutes: 180 },
    update: jest.fn(),
  }),
}));
// Sentry's SDK starts a cleanup timer on import; not needed here.
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
const mockToast = jest.fn();
jest.mock('@/components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
  useFocusEffect: (effect: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, [effect]);
  },
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));

// Saturday 10 Oct 2026, local noon. Only the clock is faked, so timers and promises behave as usual.
const NOW = new Date(2026, 9, 10, 12, 0);

beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      'nextTick',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'performance',
      'hrtime',
    ],
  });
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  (router.push as jest.Mock).mockClear();
});
afterEach(() => {
  closeDb();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** A local time on the given day of October 2026 (or September, with a negative month offset). */
const at = (day: number, hour = 12, month = 9) => new Date(2026, month, day, hour).toISOString();

const seedMeal = (name: string, verdict: Verdict, loggedAt: string) =>
  createFoodLog(mockDb, {
    entryType: 'diary',
    source: 'text',
    inputText: name,
    loggedAt,
    analysis: {
      isFood: true,
      mealName: name,
      items: [],
      overall: { verdict, confidence: 'medium', reasoning: 'Because.' },
    },
    meta: { model: 'm', promptVersion: 'p', rulesetVersion: 'r' },
  });

const seedSymptom = (loggedAt: string) =>
  createSymptomLog(mockDb, { items: [{ key: 'heartburn' }, { key: 'burping' }], loggedAt });

/** Today (Sat Oct 10), Yesterday (Fri Oct 9), Thursday Oct 8, and one meal last week (Thu Oct 1). */
const seedWeek = () => {
  seedMeal('Oatmeal with banana', 'ok', at(10, 8));
  seedMeal('Spicy chicken tacos', 'caution', at(10, 19));
  seedSymptom(at(10, 21));
  seedMeal('Grilled salmon', 'ok', at(9, 12));
  seedMeal('Pasta with tomato sauce', 'trigger', at(8, 20));
  seedSymptom(at(8, 22));
  seedMeal('Old pasta', 'trigger', at(1, 12));
};

/** Presses a button of the most recent Alert.alert, as a tap on the system dialog would. */
const pressAlertButton = (spy: jest.SpyInstance, text: string) => {
  const buttons = spy.mock.calls.at(-1)?.[2] as AlertButton[];
  buttons.find((button) => button.text === text)?.onPress?.();
};

describe('History: the week', () => {
  it('lists this week by day, newest first, under plain day labels', async () => {
    seedWeek();
    await render(<HistoryScreen />);

    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Yesterday')).toBeTruthy();
    expect(screen.getByText('Thursday, Oct 8')).toBeTruthy();
    expect(screen.getByText('Spicy chicken tacos')).toBeTruthy();
    expect(screen.getByText('Grilled salmon')).toBeTruthy();
    // Last week's meal is outside the shown week.
    expect(screen.queryByText('Old pasta')).toBeNull();
  });

  it('starts on Week with the range pill showing the week', async () => {
    await render(<HistoryScreen />);

    expect(screen.getByRole('tab', { name: 'Week' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole('button', { name: 'Oct 4 – 10' })).toBeTruthy();
  });

  it('shows a verdict badge on a meal row, in the new words', async () => {
    seedMeal('Pasta with tomato sauce', 'trigger', at(8, 20));
    seedMeal('Oatmeal', 'ok', at(8, 8));
    await render(<HistoryScreen />);

    expect(screen.getByLabelText('Avoid')).toBeTruthy();
    expect(screen.getByLabelText('Okay')).toBeTruthy();
  });

  it('shows a meal saved without a verdict with no badge', async () => {
    createUncheckedMeal(mockDb, { source: 'text', inputText: 'grilled fish', loggedAt: at(10) });
    await render(<HistoryScreen />);

    expect(screen.getByText('grilled fish')).toBeTruthy();
    expect(screen.queryByLabelText('Okay')).toBeNull();
  });

  it('lists a logged medication with its Taken pill', async () => {
    const id = createMedication(mockDb, { name: 'Omeprazole', type: 'ppi', defaultDose: '20 mg' });
    logMedication(mockDb, id, { takenAt: at(10, 8) });
    await render(<HistoryScreen />);

    expect(screen.getByText('Omeprazole 20 mg')).toBeTruthy();
    expect(screen.getByText('Taken')).toBeTruthy();
  });

  it('says so when nothing is logged this week', async () => {
    await render(<HistoryScreen />);

    expect(screen.getByText('Nothing here yet')).toBeTruthy();
    expect(screen.getByText(/Nothing logged this week/)).toBeTruthy();
    expect(screen.getByText('0 meals')).toBeTruthy();
  });
});

describe('History: the summary card', () => {
  it('counts the shown week: meals, days with symptoms and the verdict mix', async () => {
    seedWeek();
    await render(<HistoryScreen />);

    expect(screen.getByText('4 meals')).toBeTruthy();
    expect(screen.getByText('2 days with symptoms')).toBeTruthy();
    expect(screen.getByText('Okay 2')).toBeTruthy();
    expect(screen.getByText('Caution 1')).toBeTruthy();
    expect(screen.getByText('Avoid 1')).toBeTruthy();
    // No meal was marked Good, so it isn't in the legend.
    expect(screen.queryByText(/^Good/)).toBeNull();
  });

  it('is not changed by the Entries filter', async () => {
    seedWeek();
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Show, All' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Symptoms' }));

    expect(screen.getByText('4 meals')).toBeTruthy();
  });

  it('uses the singular for one meal and one day', async () => {
    seedMeal('Toast', 'ok', at(10, 8));
    seedSymptom(at(10, 9));
    await render(<HistoryScreen />);

    expect(screen.getByText('1 meal')).toBeTruthy();
    expect(screen.getByText('1 day with symptoms')).toBeTruthy();
  });
});

describe('History: the Entries filter', () => {
  it('keeps only one kind of entry, and All brings the rest back', async () => {
    seedWeek();
    const id = createMedication(mockDb, { name: 'Omeprazole', type: 'ppi', defaultDose: '20 mg' });
    logMedication(mockDb, id, { takenAt: at(10, 8) });
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Show, All' }));
    expect(screen.getAllByRole('radio').map((option) => option.props.accessibilityLabel)).toEqual([
      'All',
      'Symptoms',
      'Food',
      'Medications',
    ]);
    await fireEvent.press(screen.getByRole('radio', { name: 'Medications' }));
    expect(screen.getByText('Omeprazole 20 mg')).toBeTruthy();
    expect(screen.queryByText('Spicy chicken tacos')).toBeNull();
    // A day with nothing of that kind has no heading.
    expect(screen.queryByText('Yesterday')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Show, Medications' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'All' }));
    expect(screen.getByText('Spicy chicken tacos')).toBeTruthy();
  });

  it('says nothing of that kind when the filter matches nothing this week', async () => {
    seedMeal('Toast', 'ok', at(10, 8));
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Show, All' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Symptoms' }));

    expect(screen.getByText('Nothing of this kind this week.')).toBeTruthy();
  });
});

describe('History: the range', () => {
  it('opens a sheet of weeks with a check on the shown one', async () => {
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Oct 4 – 10' }));

    expect(screen.getByRole('header', { name: 'Choose a week' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'This week, Oct 4 – 10' }).props.accessibilityState).toEqual({
      checked: true,
    });
    expect(screen.getByRole('radio', { name: 'Last week, Sep 27 – Oct 3' }).props.accessibilityState).toEqual(
      {
        checked: false,
      },
    );
  });

  it('shows an earlier week once picked, with its entries and numbers', async () => {
    seedWeek();
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Oct 4 – 10' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Last week, Sep 27 – Oct 3' }));

    expect(screen.getByRole('button', { name: 'Sep 27 – Oct 3' })).toBeTruthy();
    expect(screen.getByText('Old pasta')).toBeTruthy();
    expect(screen.queryByText('Spicy chicken tacos')).toBeNull();
    expect(screen.getByText('1 meal')).toBeTruthy();
    expect(screen.getByText('Thursday, Oct 1')).toBeTruthy();
  });

  it('switches to the month: the whole of October, labelled by name', async () => {
    seedWeek();
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('tab', { name: 'Month' }));

    expect(screen.getByRole('button', { name: 'October' })).toBeTruthy();
    // The list renders in batches, so the month is checked by its numbers: last week's meal is in it too.
    expect(screen.getByText('5 meals')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'October' }));
    expect(screen.getByRole('header', { name: 'Choose a month' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Last month, September' }));
    expect(screen.getByRole('button', { name: 'September' })).toBeTruthy();
    expect(screen.getByText('0 meals')).toBeTruthy();
  });

  it('goes back to this week when switching back from the month', async () => {
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('tab', { name: 'Month' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Week' }));

    expect(screen.getByRole('button', { name: 'Oct 4 – 10' })).toBeTruthy();
  });
});

describe('History: opening an entry', () => {
  it('opens a meal, a symptom entry and a dose on the entry screen', async () => {
    const mealId = seedMeal('Spicy chicken tacos', 'caution', at(10, 19));
    const symptomId = seedSymptom(at(10, 21));
    const medId = createMedication(mockDb, { name: 'Omeprazole', type: 'ppi', defaultDose: '20 mg' });
    const doseId = logMedication(mockDb, medId, { takenAt: at(10, 8) });
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: /^Meal: Spicy chicken tacos/ }));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/entry',
      params: { kind: 'food', id: String(mealId) },
    });
    await fireEvent.press(screen.getByRole('button', { name: /^Symptoms: / }));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/entry',
      params: { kind: 'symptom', id: String(symptomId) },
    });
    await fireEvent.press(screen.getByRole('button', { name: /^Medication: Omeprazole/ }));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/entry',
      params: { kind: 'medication', id: String(doseId) },
    });
  });
});

const ALL_TIME = { from: '2000-01-01T00:00:00.000Z', to: '2100-01-01T00:00:00.000Z' };

describe('History: swipe to delete an entry', () => {
  it('asks first, and Cancel keeps the meal', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    seedMeal('Steamed dim sum', 'caution', at(10));
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Delete Steamed dim sum' }));
    expect(alert.mock.calls.at(-1)?.[0]).toBe('Delete this entry?');
    pressAlertButton(alert, 'Cancel');

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(1);
  });

  it('removes the meal from the list, and the numbers, once confirmed', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    seedMeal('Steamed dim sum', 'caution', at(10));
    await render(<HistoryScreen />);
    expect(screen.getByText('1 meal')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete Steamed dim sum' }));
    await act(async () => pressAlertButton(alert, 'Delete'));

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(screen.queryByText('Steamed dim sum')).toBeNull();
    expect(screen.getByText('0 meals')).toBeTruthy();
    expect(mockToast).toHaveBeenLastCalledWith('Entry deleted');
  });

  it('offers Delete to screen readers as an action on the row', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    seedMeal('Steamed dim sum', 'caution', at(10));
    await render(<HistoryScreen />);

    await fireEvent(screen.getByRole('button', { name: /^Meal: Steamed dim sum/ }), 'accessibilityAction', {
      nativeEvent: { actionName: 'delete' },
    });

    expect(alert.mock.calls.at(-1)?.[0]).toBe('Delete this entry?');
  });

  it('deletes a symptom entry and a dose the same way', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    seedSymptom(at(10, 21));
    const medId = createMedication(mockDb, { name: 'Omeprazole', type: 'ppi', defaultDose: '20 mg' });
    logMedication(mockDb, medId, { takenAt: at(10, 8) });
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: /^Delete Chest/ }));
    await act(async () => pressAlertButton(alert, 'Delete'));
    expect(screen.queryByRole('button', { name: /^Symptoms: / })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete Omeprazole 20 mg' }));
    await act(async () => pressAlertButton(alert, 'Delete'));
    expect(screen.queryByText('Omeprazole 20 mg')).toBeNull();
  });
});

describe('History: a failing load', () => {
  it('says it could not load, rather than showing an empty week', async () => {
    seedMeal('Toast', 'ok', at(10, 8));
    jest.spyOn(mockDb, 'select').mockImplementation(() => {
      throw new Error('disk');
    });
    await render(<HistoryScreen />);

    expect(screen.getByText("Couldn't load your logs")).toBeTruthy();
    expect(screen.queryByText('Nothing here yet')).toBeNull();
  });
});
