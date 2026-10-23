import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import HistoryScreen from '@/app/(tabs)/history';
import { createTestDb } from '@/db/__tests__/testDb';
import {
  createFoodLog,
  createUncheckedMeal,
  listDiaryFoodLogs,
  saveMealDetails,
} from '@/db/repositories/food';
import { createMedication, logMedication } from '@/db/repositories/medications';
import { createSymptomLog } from '@/db/repositories/symptoms';
import type { AppDb } from '@/db/types';
import { fetchInsight } from '@/services/relayClient';
import type { Verdict } from '@/types/analysis';
import type { Insight } from '@/types/insight';
import { router } from 'expo-router';

let mockDb: AppDb;
let closeDb: () => void;
jest.mock('@/services/relayClient', () => ({ fetchInsight: jest.fn() }));

jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => ({
    settings: { bedtime: '22:30', lateMealWindowMinutes: 180 },
    update: jest.fn(),
  }),
}));
// Sentry's SDK starts a cleanup timer on import; not needed here.
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
// Reanimated's native runtime can't load in Jest; use its mocks (which lack useReducedMotion).
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
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
  // Bellie's summary is still on its way unless a test says otherwise.
  jest
    .mocked(fetchInsight)
    .mockReset()
    .mockReturnValue(new Promise<Insight>(() => {}));
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

  it('opens Profile from the round button beside the title', async () => {
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Profile' }));

    expect(router.push).toHaveBeenCalledWith('/profile');
  });

  it('starts on Week with the range pill showing the week', async () => {
    await render(<HistoryScreen />);

    expect(screen.getByRole('tab', { name: 'Week' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('Oct 4 – 10')).toBeTruthy();
  });

  it('keeps the dates of a week or month as plain text, moved only by the arrows', async () => {
    await render(<HistoryScreen />);

    expect(screen.queryByRole('button', { name: 'Oct 4 – 10' })).toBeNull();
    await fireEvent.press(screen.getByText('Oct 4 – 10'));
    expect(screen.queryByRole('header', { name: 'Select dates' })).toBeNull();

    await fireEvent.press(screen.getByRole('tab', { name: 'Month' }));
    expect(screen.queryByRole('button', { name: 'October' })).toBeNull();
    await fireEvent.press(screen.getByText('October'));
    expect(screen.queryByRole('header', { name: 'Select dates' })).toBeNull();
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

describe('History: the stats cards', () => {
  it('counts the shown week on the Food card: meals, days with symptoms and the verdict mix', async () => {
    seedWeek();
    await render(<HistoryScreen />);

    expect(screen.getByText('4 meals')).toBeTruthy();
    expect(screen.getByText('2 days with symptoms')).toBeTruthy();
    // Every verdict is in the legend, even one with no meals.
    for (const name of ['Good', 'Okay', 'Caution', 'Avoid']) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('None of your meals were good.')).toBeTruthy();
  });

  it('ranks the symptoms logged in the shown week on the Top symptoms card', async () => {
    seedWeek();
    createSymptomLog(mockDb, { items: [{ key: 'heartburn' }], loggedAt: at(9, 9) });
    await render(<HistoryScreen />);

    expect(screen.getByText('Top symptoms')).toBeTruthy();
    const rows = screen.getAllByLabelText(/^(Heartburn|Burping), \d$/);
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual(['Heartburn, 3', 'Burping, 2']);
  });

  it('counts the tags of meals and symptom entries on the Top tags card, with unused tags at 0', async () => {
    const meal = seedMeal('Pasta', 'ok', at(10, 12));
    saveMealDetails(mockDb, meal, { tags: ['large_meal', 'stress'] });
    createSymptomLog(mockDb, { items: [{ key: 'heartburn' }], tags: ['stress'], loggedAt: at(10, 20) });
    await render(<HistoryScreen />);

    expect(screen.getByText('Top tags')).toBeTruthy();
    expect(screen.getByLabelText('Stress, 2')).toBeTruthy();
    expect(screen.getByLabelText('Large meal, 1')).toBeTruthy();
    expect(screen.getByLabelText('Alcohol, 0')).toBeTruthy();
  });

  it('shows three cards with the first one marked in the dots', async () => {
    await render(<HistoryScreen />);

    expect(screen.getByLabelText('Card 1 of 3')).toBeTruthy();
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

  it('says no symptoms and shows the rows empty when none were logged', async () => {
    seedMeal('Toast', 'ok', at(10, 8));
    await render(<HistoryScreen />);

    expect(screen.getByText('No symptoms')).toBeTruthy();
    expect(screen.getByLabelText('Hoarse voice, 0')).toBeTruthy();
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

describe("History: Bellie's week", () => {
  const insight: Insight = {
    tone: 'nudge',
    bellieLine: 'A gentle week, mostly good.',
    summary: 'Late dinners were the bumps, and the heartburn came after them.',
    tips: ['Eat dinner a little earlier.'],
  };

  it('makes her card the first of four, in words made on the phone until her summary arrives', async () => {
    seedWeek();
    await render(<HistoryScreen />);

    expect(screen.getByLabelText('Card 1 of 4')).toBeTruthy();
    expect(screen.getByText('Tips')).toBeTruthy();
    expect(
      screen.getByRole('header', { name: /^(A good week so far!|A few bumps this week\.)$/ }),
    ).toBeTruthy();
  });

  it('shows her own words once they arrive', async () => {
    jest.mocked(fetchInsight).mockResolvedValue(insight);
    seedWeek();
    await render(<HistoryScreen />);

    expect(await screen.findByRole('header', { name: 'A gentle week, mostly good.' })).toBeTruthy();
    expect(screen.getByText(insight.summary)).toBeTruthy();
    expect(screen.getByText('Eat dinner a little earlier.')).toBeTruthy();
  });

  it('asks about the shown week only, with just names, verdicts and times', async () => {
    seedWeek();
    await render(<HistoryScreen />);

    expect(fetchInsight).toHaveBeenCalledTimes(1);
    const request = jest.mocked(fetchInsight).mock.calls[0]![0];
    expect(request.range).toBe('week');
    expect(request.meals.map((meal) => meal.name)).not.toContain('Old pasta'); // last week's meal
    expect(Object.keys(request).sort()).toEqual(['meals', 'range', 'symptoms', 'tags']);
  });

  it('has no card of hers for a month, and asks for nothing', async () => {
    seedWeek();
    await render(<HistoryScreen />);
    jest.mocked(fetchInsight).mockClear();

    await fireEvent.press(screen.getByRole('tab', { name: 'Month' }));

    expect(screen.getByLabelText('Card 1 of 3')).toBeTruthy();
    expect(fetchInsight).not.toHaveBeenCalled();
  });

  it('has no card of hers for a week with nothing logged', async () => {
    await render(<HistoryScreen />);

    expect(screen.getByLabelText('Card 1 of 3')).toBeTruthy();
    expect(fetchInsight).not.toHaveBeenCalled();
  });
});

describe('History: stepping through weeks and months', () => {
  it('steps back to an earlier week and forward again', async () => {
    seedWeek();
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Previous week' }));

    expect(screen.getByText('Sep 27 – Oct 3')).toBeTruthy();
    expect(screen.getByText('Old pasta')).toBeTruthy();
    expect(screen.queryByText('Spicy chicken tacos')).toBeNull();
    expect(screen.getByText('1 meal')).toBeTruthy();
    expect(screen.getByText('Thursday, Oct 1')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByText('Oct 4 – 10')).toBeTruthy();
    expect(screen.getByText('Spicy chicken tacos')).toBeTruthy();
  });

  it('dims the forward arrow on the current week, and the back arrow at the first entry', async () => {
    seedWeek();
    await render(<HistoryScreen />);

    expect(screen.getByRole('button', { name: 'Next week' }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Previous week' }).props.accessibilityState.disabled).toBe(
      false,
    );

    // The week with the first entry (1 Oct) is as far back as it goes.
    await fireEvent.press(screen.getByRole('button', { name: 'Previous week' }));
    expect(screen.getByRole('button', { name: 'Previous week' }).props.accessibilityState.disabled).toBe(
      true,
    );
    expect(screen.getByRole('button', { name: 'Next week' }).props.accessibilityState.disabled).toBe(false);
  });

  it('has nowhere to step with nothing logged', async () => {
    await render(<HistoryScreen />);

    expect(screen.getByRole('button', { name: 'Previous week' }).props.accessibilityState.disabled).toBe(
      true,
    );
    expect(screen.getByRole('button', { name: 'Next week' }).props.accessibilityState.disabled).toBe(true);
  });

  it('switches to the month, labelled by name, and steps by month', async () => {
    seedWeek();
    seedMeal('September lunch', 'ok', at(20, 12, 8));
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('tab', { name: 'Month' }));

    expect(screen.getByText('October')).toBeTruthy();
    // The list renders in batches, so the month is checked by its numbers: last week's meal is in it too.
    expect(screen.getByText('5 meals')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('September')).toBeTruthy();
    expect(screen.getByText('September lunch')).toBeTruthy();
    expect(screen.getByText('1 meal')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous month' }).props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('goes back to this week when switching back from the month', async () => {
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('tab', { name: 'Month' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Week' }));

    expect(screen.getByText('Oct 4 – 10')).toBeTruthy();
  });

  it('names the three segments for a screen reader: Week, Month and All time', async () => {
    await render(<HistoryScreen />);

    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Week',
      'Month',
      'All time',
    ]);
  });
});

describe('History: all time', () => {
  it('shows everything from the first entry to today, with no arrows', async () => {
    seedWeek();
    seedMeal('September lunch', 'ok', at(20, 12, 8));
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('tab', { name: 'All time' }));

    expect(screen.getByRole('tab', { name: 'All time' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole('button', { name: 'Sep 20 – Oct 10' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Previous week' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next week' })).toBeNull();
    expect(screen.getByText('6 meals')).toBeTruthy();
  });

  it('says nothing is logged yet when it is empty', async () => {
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('tab', { name: 'All time' }));

    expect(screen.getByText(/Nothing logged yet/)).toBeTruthy();
  });
});

describe('History: the calendar', () => {
  // The calendar opens from the dates of all time (or of a range picked by hand), not of a week or month.
  const openCalendar = async () => {
    await fireEvent.press(screen.getByRole('tab', { name: 'All time' }));
    await fireEvent.press(screen.getByHintText('Opens the calendar to pick dates'));
  };

  it('opens when the dates are tapped, naming the entries on each day', async () => {
    seedWeek();
    await render(<HistoryScreen />);

    await openCalendar();

    expect(screen.getByRole('header', { name: 'Select dates' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'October 2026' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'October 10, 3 entries' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'October 9, 1 entry' })).toBeTruthy();
    // A day with nothing logged is just its date.
    expect(screen.getByRole('button', { name: 'October 5' })).toBeTruthy();
  });

  it('cannot pick a day after today', async () => {
    await render(<HistoryScreen />);

    await openCalendar();

    expect(screen.getByRole('button', { name: 'October 11' }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'October 10' }).props.accessibilityState.disabled).toBe(false);
  });

  it('shows the range picked, counts its entries, and applies it', async () => {
    seedWeek();
    await render(<HistoryScreen />);
    await openCalendar();

    expect(screen.getByRole('button', { name: 'See entries' }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'October 8, 2 entries' }));
    // The start alone is one day.
    expect(screen.getByRole('button', { name: 'See 2 entries' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'October 10, 3 entries' }));
    expect(screen.getByRole('button', { name: 'See 6 entries' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'See 6 entries' }));

    // Back on History: the range, no arrows, no segment selected, and its numbers.
    expect(screen.queryByRole('header', { name: 'Select dates' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Oct 8 – 10' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Previous week' })).toBeNull();
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.props.accessibilityState.selected).toBe(false);
    }
    expect(screen.getByText('4 meals')).toBeTruthy();
    expect(screen.getByText('Spicy chicken tacos')).toBeTruthy();
  });

  it('treats the earlier of two taps as the start', async () => {
    seedWeek();
    await render(<HistoryScreen />);
    await openCalendar();

    await fireEvent.press(screen.getByRole('button', { name: 'October 10, 3 entries' }));
    await fireEvent.press(screen.getByRole('button', { name: 'October 9, 1 entry' }));
    await fireEvent.press(screen.getByRole('button', { name: 'See 4 entries' }));

    expect(screen.getByRole('button', { name: 'Oct 9 – 10' })).toBeTruthy();
  });

  it('writes a single picked day as that day', async () => {
    seedWeek();
    await render(<HistoryScreen />);
    await openCalendar();

    await fireEvent.press(screen.getByRole('button', { name: 'October 9, 1 entry' }));
    await fireEvent.press(screen.getByRole('button', { name: 'See 1 entry' }));

    expect(screen.getByRole('button', { name: 'Oct 9' })).toBeTruthy();
    expect(screen.getByText('Grilled salmon')).toBeTruthy();
  });

  it('clears the picks on Reset', async () => {
    seedWeek();
    await render(<HistoryScreen />);
    await openCalendar();

    await fireEvent.press(screen.getByRole('button', { name: 'October 8, 2 entries' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByRole('button', { name: 'See entries' }).props.accessibilityState.disabled).toBe(true);
  });

  it('closes with the X and leaves History as it was', async () => {
    seedWeek();
    await render(<HistoryScreen />);
    await openCalendar();

    await fireEvent.press(screen.getByRole('button', { name: 'October 8, 2 entries' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    // Still on all time, with the dates unchanged.
    expect(screen.queryByRole('header', { name: 'Select dates' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Oct 1 – 10' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'All time' }).props.accessibilityState.selected).toBe(true);
  });

  it('opens on the range already picked, and can be re-picked from there', async () => {
    seedWeek();
    await render(<HistoryScreen />);
    await openCalendar();
    await fireEvent.press(screen.getByRole('button', { name: 'October 8, 2 entries' }));
    await fireEvent.press(screen.getByRole('button', { name: 'October 9, 1 entry' }));
    await fireEvent.press(screen.getByRole('button', { name: 'See 3 entries' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Oct 8 – 9' }));

    expect(screen.getByRole('button', { name: 'See 3 entries' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'October 8, 2 entries' }).props.accessibilityState.selected,
    ).toBe(true);
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

    await fireEvent.press(screen.getByRole('button', { name: /^Delete Heartburn/ }));
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
