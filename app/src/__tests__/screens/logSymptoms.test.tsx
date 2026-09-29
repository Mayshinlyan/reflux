import { fireEvent, render, screen } from '@testing-library/react-native';

import LogSymptomsScreen from '@/app/log/symptoms';
import { createTestDb } from '@/db/__tests__/testDb';
import { createSymptomLog, getSymptomLog, listSymptomLogs } from '@/db/repositories/symptoms';
import type { AppDb } from '@/db/types';

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

const ALL_TIME = { from: '2000-01-01T00:00:00.000Z', to: '2100-01-01T00:00:00.000Z' };

const press = async (role: 'button' | 'checkbox', name: string) =>
  fireEvent.press(screen.getByRole(role, { name }));

/** Opens a body area, taps the given symptoms, and returns to the map with Done. */
async function chooseIn(area: string, symptoms: string[]) {
  await press('button', area);
  for (const symptom of symptoms) await press('checkbox', symptom);
  await press('button', 'Done');
}

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockParams = {};
  mockBack.mockClear();
  mockToast.mockClear();
});

afterEach(() => closeDb());

describe('Log symptoms screen: three steps', () => {
  it('walks body map → anything else → note and saves everything chosen', async () => {
    await render(<LogSymptomsScreen />);

    // Step 1: nothing chosen yet, so Next is disabled and the whole list is not on screen.
    expect(screen.getByRole('button', { name: 'Next' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.queryByText('Heartburn')).toBeNull();
    expect(screen.getByText('Step 1 of 3 · Where it bothers you')).toBeTruthy();

    await chooseIn('Chest', ['Heartburn']);
    await chooseIn('Tummy', ['Feeling full', 'Stomach pain']);

    // Choices show only as counts, never as a list under the body.
    expect(screen.getByRole('button', { name: 'Chest, 1 selected' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tummy, 2 selected' })).toBeTruthy();
    expect(screen.queryByText('Heartburn')).toBeNull();
    expect(screen.queryByText(/Something else/)).toBeNull();

    await press('button', 'Next');

    // Step 2: lifestyle tags.
    expect(screen.getByText('Anything else going on?')).toBeTruthy();
    expect(screen.getByText('Step 2 of 3 · Anything else')).toBeTruthy();
    await press('checkbox', 'Large meal');
    await press('button', 'Next');

    // Step 3: note and save.
    expect(screen.getByText('Note (optional)')).toBeTruthy();
    expect(screen.getByText('Step 3 of 3 · Add a note')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Note'), 'after dinner');
    await press('button', 'Save entry');

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
    expect(mockBack).toHaveBeenCalled();
  });

  it('lets you skip the optional steps', async () => {
    await render(<LogSymptomsScreen />);
    await chooseIn('Throat & voice', ['Hoarse voice']);
    await press('button', 'Next');
    await press('button', 'Next');
    await press('button', 'Save entry');

    expect(listSymptomLogs(mockDb, ALL_TIME)[0]).toMatchObject({
      items: [{ key: 'hoarseness', score: 1 }],
      tags: [],
      notes: null,
    });
  });

  it('goes back one step at a time and keeps what was chosen', async () => {
    await render(<LogSymptomsScreen />);
    await chooseIn('Chest', ['Heartburn']);
    await press('button', 'Next');
    await press('checkbox', 'Stress');
    await press('button', 'Next');
    await fireEvent.changeText(screen.getByLabelText('Note'), 'kept');

    await press('button', 'Back'); // step 3 -> 2
    expect(screen.getByText('Step 2 of 3 · Anything else')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Stress' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    await press('button', 'Back'); // step 2 -> 1
    expect(screen.getByRole('button', { name: 'Chest, 1 selected' })).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();

    await press('button', 'Next');
    await press('button', 'Next');
    expect(screen.getByLabelText('Note').props.value).toBe('kept');

    await press('button', 'Back');
    await press('button', 'Back');
    await press('button', 'Back'); // step 1 -> leaves the screen
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('backs out of an open body area to the map without leaving', async () => {
    await render(<LogSymptomsScreen />);
    await press('button', 'Tummy');
    expect(screen.getByText('Tap anything that applies.')).toBeTruthy();

    await press('button', 'Back');

    expect(screen.getByText('Where are you feeling it? Tap a spot.')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('shows only that area’s symptoms after tapping it', async () => {
    await render(<LogSymptomsScreen />);
    await press('button', 'Tummy');

    expect(screen.getAllByRole('checkbox').map((el) => el.props.accessibilityLabel)).toEqual([
      'Stomach pain',
      'Feeling full',
      'Constipation',
    ]);
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

    expect(screen.getByText('Edit symptoms')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chest, 1 selected' })).toBeTruthy();

    await press('button', 'Chest, 1 selected');
    await press('checkbox', 'Nagging cough'); // deselect
    await press('checkbox', 'Heartburn');
    await press('button', 'Done');
    await press('button', 'Next');
    await press('checkbox', 'Stress'); // untag
    await press('button', 'Next');
    expect(screen.getByLabelText('Note').props.value).toBe('original');
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

    // It is no longer offered anywhere on the map...
    expect(screen.queryByText(/sleeping/i)).toBeNull();
    await chooseIn('Chest, 1 selected', ['Heartburn']);
    await press('button', 'Next');
    await press('button', 'Next');
    await press('button', 'Save changes');

    // ...but the earlier entry keeps it.
    expect(getSymptomLog(mockDb, id)?.items.map((item) => item.key)).toEqual(['cough', 'heartburn', 'sleep']);
  });

  it('says so when the entry no longer exists', async () => {
    mockParams = { id: '999' };
    await render(<LogSymptomsScreen />);
    expect(screen.getByText('This entry no longer exists.')).toBeTruthy();
  });
});
