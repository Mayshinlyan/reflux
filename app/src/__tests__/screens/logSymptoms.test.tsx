import { fireEvent, render, screen } from '@testing-library/react-native';

import LogSymptomsScreen, { symptomsTitle } from '@/app/log/symptoms';
import { createTestDb } from '@/db/__tests__/testDb';
import { createUncheckedMeal } from '@/db/repositories/food';
import { createSymptomLog, getSymptomLog, listSymptomLogs } from '@/db/repositories/symptoms';
import type { AppDb } from '@/db/types';

let mockDb: AppDb;
let closeDb: () => void;
let mockParams: { id?: string; date?: string; afterFood?: string } = {};
const mockBack = jest.fn();
const mockChing = jest.fn();
jest.mock('@/lib/ching', () => ({ playChing: () => mockChing() }));
const mockToast = jest.fn();

jest.mock('@/db/DatabaseProvider', () => ({ useDb: () => mockDb }));
// Sentry's SDK starts a cleanup timer on import; not needed here.
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('@/components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('expo-router', () => ({
  router: { back: () => mockBack(), canGoBack: () => true, replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ setOptions: jest.fn() }),
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

// The time picker's sheet reads safe-area insets, and its native wheel can't render here.
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

const press = async (role: 'button' | 'checkbox', name: string) =>
  fireEvent.press(screen.getByRole(role, { name }));

/** Taps the given symptoms (every area is on the screen at once). */
async function choose(...symptoms: string[]) {
  for (const symptom of symptoms) await press('checkbox', symptom);
}

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockParams = {};
  mockBack.mockClear();
  mockChing.mockClear();
  mockToast.mockClear();
});

afterEach(() => closeDb());

describe('symptomsTitle', () => {
  it('reads the picks as a short phrase', () => {
    expect(symptomsTitle(['Heartburn'])).toBe('Heartburn');
    expect(symptomsTitle(['Heartburn', 'Burping'])).toBe('Heartburn and burping');
    expect(symptomsTitle(['Heartburn', 'Burping', 'Hoarse voice'])).toBe('Heartburn, burping and 1 more');
  });
});

describe('Log symptoms screen: pick, then details', () => {
  it('chooses symptoms across areas, then saves them with contributors and a note', async () => {
    await render(<LogSymptomsScreen />);

    // Pick: nothing is chosen, so Next is disabled.
    expect(screen.getByText('What are you feeling?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });

    await choose('Heartburn');
    await choose('Feeling full', 'Stomach pain');
    // Picks from different areas are all shown as chosen.
    expect(screen.getByRole('checkbox', { name: 'Heartburn' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    await press('button', 'Next');

    // Details: the title reads the picks, in the usual order.
    expect(screen.getByText('Heartburn, stomach pain and 1 more')).toBeTruthy();
    await press('checkbox', 'Large meal');
    await fireEvent.changeText(screen.getByLabelText('Note'), 'after dinner');
    await press('button', 'Save');

    const [log] = listSymptomLogs(mockDb, ALL_TIME);
    // Canonical order, one row per symptom, no severity chosen by the user.
    expect(log?.items).toEqual([
      { key: 'heartburn', score: 1 },
      { key: 'stomach_pain', score: 1 },
      { key: 'feeling_full', score: 1 },
    ]);
    expect(log?.tags).toEqual(['large_meal']);
    expect(log?.notes).toBe('after dinner');
    expect(mockToast).toHaveBeenCalledWith('Symptoms logged');
    expect(mockChing).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalled();
  });

  it('lets you skip the contributors and the note', async () => {
    await render(<LogSymptomsScreen />);
    await choose('Hoarse voice');
    await press('button', 'Next');
    await press('button', 'Save');

    expect(listSymptomLogs(mockDb, ALL_TIME)[0]).toMatchObject({
      items: [{ key: 'hoarseness', score: 1 }],
      tags: [],
      notes: null,
    });
  });

  it('shows every symptom at once, grouped under its body area', async () => {
    await render(<LogSymptomsScreen />);

    for (const area of ['Throat & voice', 'Chest', 'Tummy']) expect(screen.getByText(area)).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getAllByRole('checkbox').map((el) => el.props.accessibilityLabel)).toEqual([
      'Hoarse voice',
      'Throat clearing',
      'Excess mucus',
      'Trouble swallowing',
      'Lump in throat',
      'Heartburn',
      'Burping',
      'Breathing trouble',
      'Cough after eating',
      'Nagging cough',
      'Stomach pain',
      'Feeling full',
      'Constipation',
    ]);
  });

  it('goes back to the picks without leaving, keeping what was chosen', async () => {
    await render(<LogSymptomsScreen />);
    await choose('Heartburn');
    await press('button', 'Next');
    await press('checkbox', 'Stress');
    await fireEvent.changeText(screen.getByLabelText('Note'), 'kept');

    await press('button', 'Back'); // details -> pick
    expect(screen.getByText('What are you feeling?')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();

    await press('button', 'Next');
    expect(screen.getByRole('checkbox', { name: 'Stress' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByLabelText('Note').props.value).toBe('kept');

    await press('button', 'Back');
    await press('button', 'Back'); // pick -> leaves the screen
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('Log symptoms screen: the meal they followed', () => {
  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

  const toDetails = async () => {
    await choose('Heartburn');
    await press('button', 'Next');
  };

  it('links the latest meal from the last three hours, and saves the link', async () => {
    createUncheckedMeal(mockDb, { source: 'text', inputText: 'old pasta', loggedAt: minutesAgo(300) });
    createUncheckedMeal(mockDb, { source: 'text', inputText: 'spicy tacos', loggedAt: minutesAgo(90) });
    const tacos = createUncheckedMeal(mockDb, {
      source: 'text',
      inputText: 'late tacos',
      loggedAt: minutesAgo(30),
    });
    await render(<LogSymptomsScreen />);
    await toDetails();

    expect(screen.getByText('Linked meal')).toBeTruthy();
    expect(screen.getByText('late tacos')).toBeTruthy();
    expect(screen.queryByText('old pasta')).toBeNull();
    await press('button', 'Save');

    expect(listSymptomLogs(mockDb, ALL_TIME)[0]?.foodLogId).toBe(tacos);
  });

  it('can be unlinked, and linked again', async () => {
    createUncheckedMeal(mockDb, { source: 'text', inputText: 'late tacos', loggedAt: minutesAgo(30) });
    await render(<LogSymptomsScreen />);
    await toDetails();

    expect(screen.getByText('Tap to unlink.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Meal: late tacos/ }));
    expect(screen.getByText('Not linked. Tap to link.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Meal: late tacos/ }));
    expect(screen.getByText('Tap to unlink.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Meal: late tacos/ }));
    await press('button', 'Save');
    expect(listSymptomLogs(mockDb, ALL_TIME)[0]?.foodLogId).toBeNull();
  });

  it('has no linked meal section when nothing was eaten recently', async () => {
    createUncheckedMeal(mockDb, { source: 'text', inputText: 'old pasta', loggedAt: minutesAgo(300) });
    await render(<LogSymptomsScreen />);
    await toDetails();

    expect(screen.queryByText('Linked meal')).toBeNull();
  });

  it('links the meal named by afterFood, however long ago it was', async () => {
    const id = createUncheckedMeal(mockDb, {
      source: 'text',
      inputText: 'old pasta',
      loggedAt: minutesAgo(300),
    });
    mockParams = { afterFood: String(id) };
    await render(<LogSymptomsScreen />);
    await toDetails();
    await press('button', 'Save');

    expect(listSymptomLogs(mockDb, ALL_TIME)[0]?.foodLogId).toBe(id);
  });
});

describe('Log symptoms screen: editing', () => {
  it('opens an existing entry with its choices already made and saves changes in place', async () => {
    const id = createSymptomLog(mockDb, {
      items: [{ key: 'cough' }],
      tags: ['stress'],
      notes: 'original',
    });
    mockParams = { id: String(id) };
    await render(<LogSymptomsScreen />);

    // Opens with the entry's symptom already chosen.
    expect(screen.getByRole('checkbox', { name: 'Nagging cough' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    await press('checkbox', 'Nagging cough'); // deselect
    await press('checkbox', 'Heartburn');
    await press('button', 'Next');
    await press('checkbox', 'Stress'); // untag
    expect(screen.getByLabelText('Note').props.value).toBe('original');
    // An entry being edited has no linked-meal section.
    expect(screen.queryByText('Linked meal')).toBeNull();
    await press('button', 'Save changes');

    expect(listSymptomLogs(mockDb, ALL_TIME)).toHaveLength(1);
    expect(getSymptomLog(mockDb, id)).toMatchObject({
      items: [{ key: 'heartburn', score: 1 }],
      tags: [],
    });
    expect(mockToast).toHaveBeenCalledWith('Entry updated');
  });

  it('keeps a retired symptom (Trouble sleeping) on an older entry when other things are edited', async () => {
    const id = createSymptomLog(mockDb, { items: [{ key: 'cough' }, { key: 'sleep' }] });
    mockParams = { id: String(id) };
    await render(<LogSymptomsScreen />);

    // It is no longer offered anywhere...
    expect(screen.queryByText(/sleeping/i)).toBeNull();
    await press('checkbox', 'Heartburn');
    await press('button', 'Next');
    await press('button', 'Save changes');

    // ...but the earlier entry keeps it.
    expect(getSymptomLog(mockDb, id)?.items.map((item) => item.key)).toEqual(['cough', 'heartburn', 'sleep']);
  });

  it('will not go on when an edit leaves nothing chosen', async () => {
    const id = createSymptomLog(mockDb, { items: [{ key: 'cough' }] });
    mockParams = { id: String(id) };
    await render(<LogSymptomsScreen />);

    await press('checkbox', 'Nagging cough'); // deselect the only symptom

    expect(screen.getByRole('button', { name: 'Next' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('says so when the entry no longer exists', async () => {
    mockParams = { id: '999' };
    await render(<LogSymptomsScreen />);
    expect(screen.getByText('This entry no longer exists.')).toBeTruthy();
  });

  it('does not move an entry to another day, or change its time zone', async () => {
    const id = createSymptomLog(mockDb, {
      items: [{ key: 'heartburn' }],
      loggedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      tz: 'Pacific/Auckland',
    });
    const before = getSymptomLog(mockDb, id)!;
    mockParams = { id: String(id), date: '2020-01-01' };
    await render(<LogSymptomsScreen />);
    await press('button', 'Next');
    await press('button', 'Save changes');

    const after = getSymptomLog(mockDb, id)!;
    expect(after.loggedAt).toBe(before.loggedAt);
    expect(after.tz).toBe('Pacific/Auckland');
  });
});

describe('Log symptoms screen: logging on an earlier day (from the week strip)', () => {
  /** The local calendar day `daysAgo` days back, as a "YYYY-MM-DD" key and as its parts. */
  const day = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const key = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ];
    return { key: key.join('-'), year: d.getFullYear(), month: d.getMonth(), date: d.getDate() };
  };

  const saveHeartburn = async () => {
    await choose('Heartburn');
    await press('button', 'Next');
    await press('button', 'Save');
  };

  it('shows that day in the time pill and saves the entry on it, at noon', async () => {
    const earlier = day(2);
    mockParams = { date: earlier.key };
    await render(<LogSymptomsScreen />);
    await choose('Heartburn');
    await press('button', 'Next');
    expect(screen.getByText(/12:00 PM$/)).toBeTruthy();
    await press('button', 'Save');

    const [log] = listSymptomLogs(mockDb, ALL_TIME);
    expect(new Date(log!.loggedAt).getTime()).toBe(
      new Date(earlier.year, earlier.month, earlier.date, 12, 0).getTime(),
    );
  });

  it('treats today (or a day it cannot log on) as now', async () => {
    for (const date of [day(0).key, day(-3).key, 'junk', day(30).key]) {
      mockParams = { date };
      await render(<LogSymptomsScreen />);
      await saveHeartburn();
      await screen.unmount();
    }

    const logs = listSymptomLogs(mockDb, ALL_TIME);
    expect(logs).toHaveLength(4);
    for (const log of logs)
      expect(Math.abs(Date.now() - new Date(log.loggedAt).getTime())).toBeLessThan(60_000);
  });
});
