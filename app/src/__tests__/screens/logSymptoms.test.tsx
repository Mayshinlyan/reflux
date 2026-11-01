import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import LogSymptomsScreen, { symptomsTitle } from '@/app/log/symptoms';
import { createTestDb } from '@/db/__tests__/testDb';
import { createUncheckedMeal } from '@/db/repositories/food';
import { createSavedSymptom, listSavedSymptoms } from '@/db/repositories/savedSymptoms';
import { setSetting } from '@/db/repositories/settings';
import { createSymptomLog, getSymptomLog, listSymptomLogs } from '@/db/repositories/symptoms';
import type { AppDb } from '@/db/types';

let mockDb: AppDb;
let closeDb: () => void;
let mockParams: { id?: string; date?: string; afterFood?: string } = {};
const mockBack = jest.fn();
const mockSetOptions = jest.fn();
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
  useNavigation: () => ({ setOptions: mockSetOptions }),
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
  jest.mocked(Notifications.cancelScheduledNotificationAsync).mockClear();
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockParams = {};
  mockBack.mockClear();
  mockSetOptions.mockClear();
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
  it('waits for a symptom before Next, then saves from the details with Done', async () => {
    await render(<LogSymptomsScreen />);
    expect(screen.getByRole('button', { name: 'Next' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    // There is no Done on the first step.
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();

    await choose('Heartburn');
    expect(screen.getByRole('button', { name: 'Next' }).props.accessibilityState).not.toMatchObject({
      disabled: true,
    });
    // With a symptom picked the quiet "No symptoms" link is not offered.
    expect(screen.queryByRole('button', { name: 'No symptoms' })).toBeNull();
    await press('button', 'Next');
    await press('button', 'Done');

    expect(listSymptomLogs(mockDb, ALL_TIME)[0]).toMatchObject({
      items: [{ key: 'heartburn', score: 1 }],
      tags: [],
      notes: null,
    });
    expect(mockToast).toHaveBeenCalledWith('Logged');
    expect(mockBack).toHaveBeenCalled();
  });

  it('lists the symptoms they usually feel first within each area', async () => {
    setSetting(mockDb, 'usualSymptoms', ['constipation', 'hoarseness']);
    await render(<LogSymptomsScreen />);

    const names = screen.getAllByRole('checkbox').map((chip) => chip.props.accessibilityLabel as string);
    // Tummy normally starts with Stomach pain; the area keeps its other symptoms in their usual order.
    expect(names.indexOf('Constipation')).toBeLessThan(names.indexOf('Stomach pain'));
    expect(names.indexOf('Stomach pain')).toBeLessThan(names.indexOf('Feeling full'));
    expect(names.indexOf('Hoarse voice')).toBe(0);
  });

  it('chooses symptoms across areas, then saves them with lifestyle chips and a note', async () => {
    await render(<LogSymptomsScreen />);

    // Pick: nothing is chosen yet, so Next waits and the only way on is "No symptoms".
    expect(screen.getByText('How do you feel?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByRole('button', { name: 'No symptoms' })).toBeTruthy();

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
    await press('button', 'Done');

    const [log] = listSymptomLogs(mockDb, ALL_TIME);
    // Canonical order, one row per symptom, no severity chosen by the user.
    expect(log?.items).toEqual([
      { key: 'heartburn', score: 1 },
      { key: 'stomach_pain', score: 1 },
      { key: 'feeling_full', score: 1 },
    ]);
    expect(log?.tags).toEqual(['large_meal']);
    expect(log?.notes).toBe('after dinner');
    expect(mockToast).toHaveBeenCalledWith('Logged');
    expect(mockChing).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalled();
  });

  it('lets you skip the lifestyle chips and the note', async () => {
    await render(<LogSymptomsScreen />);
    await choose('Hoarse voice');
    await press('button', 'Next');
    await press('button', 'Done');

    expect(listSymptomLogs(mockDb, ALL_TIME)[0]).toMatchObject({
      items: [{ key: 'hoarseness', score: 1 }],
      tags: [],
      notes: null,
    });
  });

  it('always lists Throat & voice, then Chest, then Tummy, whatever the condition', async () => {
    setSetting(mockDb, 'conditions', ['gastritis']);
    await render(<LogSymptomsScreen />);

    const names = screen.getAllByRole('checkbox').map((chip) => chip.props.accessibilityLabel as string);
    expect(names.indexOf('Hoarse voice')).toBe(0);
    expect(names.indexOf('Heartburn')).toBeLessThan(names.indexOf('Stomach pain'));
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
    expect(screen.getByText('How do you feel?')).toBeTruthy();
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

describe('Log symptoms screen: the edge swipe back', () => {
  const swipeBackAllowed = () => mockSetOptions.mock.calls.at(-1)?.[0].gestureEnabled;

  it('is on while nothing is picked, and off once there is something to lose', async () => {
    await render(<LogSymptomsScreen />);
    expect(swipeBackAllowed()).toBe(true);

    await choose('Heartburn');
    expect(swipeBackAllowed()).toBe(false);

    await choose('Heartburn'); // picked off again
    expect(swipeBackAllowed()).toBe(true);
  });

  it('stays off on the details step', async () => {
    await render(<LogSymptomsScreen />);
    await choose('Heartburn');
    await press('button', 'Next');
    expect(swipeBackAllowed()).toBe(false);
  });

  it('stays on when editing an entry, which is untouched until it is saved', async () => {
    const id = createSymptomLog(mockDb, { items: [{ key: 'heartburn' }] });
    mockParams = { id: String(id) };
    await render(<LogSymptomsScreen />);

    expect(swipeBackAllowed()).toBe(true);
  });
});

describe('Log symptoms screen: the meal they followed', () => {
  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

  const toDetails = async () => {
    await choose('Heartburn');
    await press('button', 'Next');
  };

  it('offers the latest meal from the last three hours, unlinked until you tap it', async () => {
    createUncheckedMeal(mockDb, { source: 'text', inputText: 'old pasta', loggedAt: minutesAgo(300) });
    createUncheckedMeal(mockDb, { source: 'text', inputText: 'spicy tacos', loggedAt: minutesAgo(90) });
    const tacos = createUncheckedMeal(mockDb, {
      source: 'text',
      inputText: 'late tacos',
      loggedAt: minutesAgo(30),
    });
    await render(<LogSymptomsScreen />);
    await toDetails();

    expect(screen.getByText('Recent meal')).toBeTruthy();
    expect(screen.getByText('late tacos')).toBeTruthy();
    expect(screen.queryByText('old pasta')).toBeNull();
    expect(screen.getByText('Tap to link it to these symptoms.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Meal: late tacos/ }));
    expect(screen.getByText('Linked to these symptoms. Tap to unlink.')).toBeTruthy();
    await press('button', 'Done');

    expect(listSymptomLogs(mockDb, ALL_TIME)[0]?.foodLogId).toBe(tacos);
  });

  it('saves no link unless the meal was tapped, and a tap can be undone', async () => {
    createUncheckedMeal(mockDb, { source: 'text', inputText: 'late tacos', loggedAt: minutesAgo(30) });
    await render(<LogSymptomsScreen />);
    await toDetails();
    await press('button', 'Done');
    expect(listSymptomLogs(mockDb, ALL_TIME)[0]?.foodLogId).toBeNull();
    await screen.unmount();

    await render(<LogSymptomsScreen />);
    await toDetails();
    await fireEvent.press(screen.getByRole('button', { name: /^Meal: late tacos/ }));
    await fireEvent.press(screen.getByRole('button', { name: /^Meal: late tacos/ }));
    expect(screen.getByText('Tap to link it to these symptoms.')).toBeTruthy();
    await press('button', 'Done');
    expect(listSymptomLogs(mockDb, ALL_TIME)[1]?.foodLogId).toBeNull();
  });

  it('has no recent meal section when nothing was eaten recently', async () => {
    createUncheckedMeal(mockDb, { source: 'text', inputText: 'old pasta', loggedAt: minutesAgo(300) });
    await render(<LogSymptomsScreen />);
    await toDetails();

    expect(screen.queryByText('Recent meal')).toBeNull();
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
    await press('button', 'Done');

    expect(listSymptomLogs(mockDb, ALL_TIME)[0]?.foodLogId).toBe(id);
  });

  it('drops the meal’s check-in reminder once the check-in is saved', async () => {
    const id = createUncheckedMeal(mockDb, {
      source: 'text',
      inputText: 'old pasta',
      loggedAt: minutesAgo(300),
    });
    mockParams = { afterFood: String(id) };
    await render(<LogSymptomsScreen />);
    await toDetails();
    await press('button', 'Done');

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(`meal-${id}`);
  });

  it('leaves reminders alone for a check-in that is not about a meal', async () => {
    await render(<LogSymptomsScreen />);
    await toDetails();
    await press('button', 'Done');

    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
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
    expect(screen.queryByText('Recent meal')).toBeNull();
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

  it('will not save an edit that leaves nothing chosen', async () => {
    const id = createSymptomLog(mockDb, { items: [{ key: 'cough' }] });
    mockParams = { id: String(id) };
    await render(<LogSymptomsScreen />);

    await press('checkbox', 'Nagging cough'); // deselect the only symptom

    expect(screen.getByRole('button', { name: 'Save changes' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByRole('button', { name: 'Next' }).props.accessibilityState).not.toMatchObject({
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
    await press('button', 'Done');
  };

  it('shows that day in the time pill and saves the entry on it, at noon', async () => {
    const earlier = day(2);
    mockParams = { date: earlier.key };
    await render(<LogSymptomsScreen />);
    await choose('Heartburn');
    await press('button', 'Next');
    expect(screen.getByText(/12:00 PM$/)).toBeTruthy();
    await press('button', 'Done');

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

describe('Adding your own with a + chip', () => {
  /** Opens a group's + chip, types, and presses return. */
  const addTo = async (group: string, text: string) => {
    await press('button', `Add your own to ${group}`);
    const field = screen.getByLabelText(`Add your own to ${group}`);
    await fireEvent.changeText(field, text);
    await fireEvent(field, 'submitEditing');
  };

  it('adds a symptom to the group it was typed in: picked, saved there and logged with the entry', async () => {
    await render(<LogSymptomsScreen />);

    await addTo('Chest', '  Hiccups ');

    expect(screen.getByRole('checkbox', { name: 'Hiccups' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(listSavedSymptoms(mockDb)).toMatchObject([{ name: 'Hiccups', kind: 'symptom', zone: 'chest' }]);
    await press('button', 'Next');
    expect(screen.getByText('Hiccups')).toBeTruthy(); // the details title
    await press('button', 'Done');

    expect(listSymptomLogs(mockDb, ALL_TIME)[0]?.items).toEqual([{ key: 'custom:Hiccups', score: 1 }]);
  });

  it('offers the ones added before inside their group, after the built-in chips, unpicked', async () => {
    createSavedSymptom(mockDb, 'Jaw tightness', 'symptom', 'throat');
    createSavedSymptom(mockDb, 'Dry mouth', 'symptom', 'throat');
    await render(<LogSymptomsScreen />);

    const names = screen.getAllByRole('checkbox').map((chip) => chip.props.accessibilityLabel as string);
    expect(names.indexOf('Lump in throat')).toBeLessThan(names.indexOf('Dry mouth'));
    expect(names.indexOf('Jaw tightness')).toBeLessThan(names.indexOf('Heartburn'));
    expect(screen.getByRole('checkbox', { name: 'Dry mouth' }).props.accessibilityState).toMatchObject({
      checked: false,
    });
    await choose('Dry mouth');
    await press('button', 'Next');
    await press('button', 'Done');
    expect(listSymptomLogs(mockDb, ALL_TIME)[0]?.items).toEqual([{ key: 'custom:Dry mouth', score: 1 }]);
  });

  it('ends with an Other group that has a + chip, and puts a saved symptom with no known group there', async () => {
    createSavedSymptom(mockDb, 'Hiccups');
    await render(<LogSymptomsScreen />);

    expect(screen.getByText('Other')).toBeTruthy();
    const names = screen.getAllByRole('checkbox').map((chip) => chip.props.accessibilityLabel as string);
    expect(names.at(-1)).toBe('Hiccups');
    expect(names.indexOf('Constipation')).toBeLessThan(names.indexOf('Hiccups'));
  });

  it('adds a symptom typed in Other to that group and saves it there', async () => {
    await render(<LogSymptomsScreen />);

    await addTo('Other', 'Jaw tightness');

    expect(screen.getByRole('checkbox', { name: 'Jaw tightness' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(listSavedSymptoms(mockDb)).toMatchObject([{ name: 'Jaw tightness', zone: 'other' }]);
  });

  it('shows the same symptom in only one group when it is typed into a different one', async () => {
    createSavedSymptom(mockDb, 'Hiccups', 'symptom', 'chest');
    await render(<LogSymptomsScreen />);

    await addTo('Tummy', 'hiccups');

    expect(screen.getAllByRole('checkbox', { name: 'Hiccups' })).toHaveLength(1);
  });

  it('picks the built-in symptom when you type its name, without saving a copy', async () => {
    await render(<LogSymptomsScreen />);

    await addTo('Tummy', 'heartburn');

    expect(screen.getByRole('checkbox', { name: 'Heartburn' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(listSavedSymptoms(mockDb)).toEqual([]);
  });

  it('does not add a second chip for a name already saved, whatever the capitals', async () => {
    createSavedSymptom(mockDb, 'Hiccups', 'symptom', 'chest');
    await render(<LogSymptomsScreen />);

    await addTo('Chest', 'hiccups');

    expect(screen.getAllByRole('checkbox', { name: 'Hiccups' })).toHaveLength(1);
    expect(listSavedSymptoms(mockDb)).toHaveLength(1);
  });

  it('drops what was typed when the field is left without pressing return, and ignores blanks', async () => {
    await render(<LogSymptomsScreen />);

    await press('button', 'Add your own to Chest');
    await fireEvent.changeText(screen.getByLabelText('Add your own to Chest'), 'Hiccups');
    await fireEvent(screen.getByLabelText('Add your own to Chest'), 'blur');
    await addTo('Chest', '   ');

    expect(screen.queryByRole('checkbox', { name: 'Hiccups' })).toBeNull();
    expect(listSavedSymptoms(mockDb)).toEqual([]);
  });

  it('adds a lifestyle factor on the details step, saved as a lifestyle addition and logged as a tag', async () => {
    await render(<LogSymptomsScreen />);
    await choose('Heartburn');
    await press('button', 'Next');

    await addTo("What's going on?", 'Skipped breakfast');

    expect(
      screen.getByRole('checkbox', { name: 'Skipped breakfast' }).props.accessibilityState,
    ).toMatchObject({
      checked: true,
    });
    expect(listSavedSymptoms(mockDb)).toMatchObject([
      { name: 'Skipped breakfast', kind: 'lifestyle', zone: null },
    ]);
    await press('button', 'Done');

    expect(listSymptomLogs(mockDb, ALL_TIME)[0]?.tags).toEqual(['custom:Skipped breakfast']);
  });

  it('picks the built-in tag when you type its name', async () => {
    await render(<LogSymptomsScreen />);
    await choose('Heartburn');
    await press('button', 'Next');

    await addTo("What's going on?", 'stress');
    await press('button', 'Done');

    expect(listSymptomLogs(mockDb, ALL_TIME)[0]?.tags).toEqual(['stress']);
    expect(listSavedSymptoms(mockDb)).toEqual([]);
  });

  it('offers saved lifestyle factors after the built-in tags', async () => {
    createSavedSymptom(mockDb, 'Skipped breakfast', 'lifestyle');
    await render(<LogSymptomsScreen />);
    await choose('Heartburn');
    await press('button', 'Next');

    const tags = screen.getAllByRole('checkbox').map((chip) => chip.props.accessibilityLabel as string);
    expect(tags).toEqual([
      'Stress',
      'Lay down after eating',
      'Large meal',
      'Alcohol',
      'Exercise',
      'Poor sleep',
      'Skipped breakfast',
    ]);
  });

  it('keeps a custom symptom and tag when editing an entry, even after they were removed from your list', async () => {
    const id = createSymptomLog(mockDb, {
      items: [{ key: 'heartburn' }, { key: 'custom:Hiccups' }],
      tags: ['custom:Skipped breakfast'],
    });
    mockParams = { id: String(id) };
    await render(<LogSymptomsScreen />);

    expect(screen.getByRole('checkbox', { name: 'Hiccups' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    await press('button', 'Next');
    expect(
      screen.getByRole('checkbox', { name: 'Skipped breakfast' }).props.accessibilityState,
    ).toMatchObject({
      checked: true,
    });
    await press('button', 'Save changes');

    expect(getSymptomLog(mockDb, id)).toMatchObject({
      items: [{ key: 'heartburn' }, { key: 'custom:Hiccups' }],
      tags: ['custom:Skipped breakfast'],
    });
  });

  it("keeps the chip of an entry's own symptom after it is tapped off, so it can be tapped back on", async () => {
    const id = createSymptomLog(mockDb, { items: [{ key: 'heartburn' }, { key: 'custom:Hiccups' }] });
    mockParams = { id: String(id) };
    await render(<LogSymptomsScreen />);

    await press('checkbox', 'Hiccups');
    expect(screen.getByRole('checkbox', { name: 'Hiccups' }).props.accessibilityState).toMatchObject({
      checked: false,
    });
    await press('checkbox', 'Hiccups');
    expect(screen.getByRole('checkbox', { name: 'Hiccups' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
  });
});

describe('Log symptoms screen: lifestyle on its own', () => {
  const minutesAgo = (n: number) => new Date(Date.now() - n * 60 * 1000).toISOString();
  const isDisabled = (name: string) =>
    Boolean(screen.getByRole('button', { name }).props.accessibilityState?.disabled);

  it('goes on with "No symptoms", titles the details "Just checking in", and saves once something is picked', async () => {
    await render(<LogSymptomsScreen />);
    expect(isDisabled('Next')).toBe(true);
    await press('button', 'No symptoms');

    expect(screen.getByText('Just checking in')).toBeTruthy();
    expect(isDisabled('Done')).toBe(true); // nothing to save yet

    await press('checkbox', 'Stress');
    await press('checkbox', 'Lay down after eating');
    expect(isDisabled('Done')).toBe(false);
    await press('button', 'Done');

    const [log] = listSymptomLogs(mockDb, ALL_TIME);
    expect(log?.items).toEqual([]);
    expect(log?.tags.sort()).toEqual(['lay_down_after_eating', 'stress']);
    expect(mockToast).toHaveBeenCalledWith('Logged');
    expect(mockBack).toHaveBeenCalled();
  });

  it('offers no meal to link, and saves no link, when there are no symptoms', async () => {
    createUncheckedMeal(mockDb, { source: 'text', inputText: 'late tacos', loggedAt: minutesAgo(30) });
    await render(<LogSymptomsScreen />);
    await press('button', 'No symptoms');

    expect(screen.queryByText('Recent meal')).toBeNull();
    await press('checkbox', 'Stress');
    await press('button', 'Done');
    expect(listSymptomLogs(mockDb, ALL_TIME)[0]?.foodLogId).toBeNull();
  });

  it('lets a lifestyle-only entry be saved from the first step when edited', async () => {
    const id = createSymptomLog(mockDb, { items: [], tags: ['stress'] });
    mockParams = { id: String(id) };
    await render(<LogSymptomsScreen />);

    expect(isDisabled('Save changes')).toBe(false);
    await press('button', 'Next');
    expect(screen.getByText('Just checking in')).toBeTruthy();
    await press('checkbox', 'Alcohol');
    await press('button', 'Save changes');

    expect(getSymptomLog(mockDb, id)?.tags.sort()).toEqual(['alcohol', 'stress']);
    expect(getSymptomLog(mockDb, id)?.items).toEqual([]);
  });
});
