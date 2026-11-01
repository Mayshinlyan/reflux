import { fireEvent, render, screen } from '@testing-library/react-native';

import UsualSymptomsScreen from '@/app/usual-symptoms';
import { BODY_ZONES } from '@/constants/bodyZones';
import { createTestDb } from '@/db/__tests__/testDb';
import * as savedSymptomsRepo from '@/db/repositories/savedSymptoms';
import { createSavedSymptom, listSavedSymptoms } from '@/db/repositories/savedSymptoms';
import { getSetting, setSetting } from '@/db/repositories/settings';
import { createSymptomLog, listSymptomLogs } from '@/db/repositories/symptoms';
import type { AppDb } from '@/db/types';

let mockDb: AppDb;
let closeDb: () => void;

// A small stand-in for the real provider's settings hook, backed by the real repository. Like the
// real one, every caller shares the same settings: a save re-renders the screen.
const mockListeners = new Set<() => void>();
jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useEffect, useReducer } = require('react');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const repo = require('@/db/repositories/settings');
    const [, rerender] = useReducer((n: number) => n + 1, 0);
    useEffect(() => {
      mockListeners.add(rerender);
      return () => void mockListeners.delete(rerender);
    }, []);
    return {
      settings: repo.getAllSettings(mockDb),
      reload: () => mockListeners.forEach((listener) => listener()),
      update: (key: string, value: unknown) => {
        repo.setSetting(mockDb, key, value);
        mockListeners.forEach((listener) => listener());
      },
    };
  },
}));
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
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
  useFocusEffect: (effect: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, [effect]);
  },
}));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
});
afterEach(() => closeDb());

const press = async (role: 'button' | 'checkbox', name: string) =>
  fireEvent.press(screen.getByRole(role, { name }));

describe('Usual symptoms', () => {
  it('lists only the symptoms you chose, each with its body area, and no instruction line', async () => {
    setSetting(mockDb, 'usualSymptoms', ['burping', 'heartburn', 'hoarseness']);
    await render(<UsualSymptomsScreen />);

    expect(screen.getByRole('header', { name: 'Usual symptoms' })).toBeTruthy();
    // Catalog order, not the order they were saved in.
    const names = screen
      .getAllByRole('button')
      .map((button) => button.props.accessibilityLabel as string)
      .filter((label) => ['Hoarse voice', 'Heartburn', 'Burping'].includes(label));
    expect(names).toEqual(['Hoarse voice', 'Heartburn', 'Burping']);
    expect(screen.getByText('Throat & voice')).toBeTruthy();
    expect(screen.getAllByText('Chest')).toHaveLength(2);
    // Not every symptom, only the chosen ones.
    expect(screen.queryByRole('button', { name: 'Stomach pain' })).toBeNull();
    expect(screen.queryByText(/Tap /)).toBeNull();
  });

  it('says so in a few words when none are chosen, and still offers Add a symptom', async () => {
    await render(<UsualSymptomsScreen />);

    expect(screen.getByText('No usual symptoms yet.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a symptom' })).toBeTruthy();
  });

  it('says the list could not load, and that it is still on the phone, when reading fails', async () => {
    const list = jest.spyOn(savedSymptomsRepo, 'listSavedSymptoms').mockImplementation(() => {
      throw new Error('read failed');
    });
    await render(<UsualSymptomsScreen />);
    list.mockRestore();

    expect(screen.getByText(/Your usual symptoms are still on this phone\./)).toBeTruthy();
    expect(screen.queryByText('No usual symptoms yet.')).toBeNull();
  });

  it('opens a symptom to remove it, leaving the others', async () => {
    setSetting(mockDb, 'usualSymptoms', ['heartburn', 'burping']);
    await render(<UsualSymptomsScreen />);

    await press('button', 'Heartburn');
    await press('button', 'Remove');

    expect(getSetting(mockDb, 'usualSymptoms')).toEqual(['burping']);
    expect(screen.queryByRole('button', { name: 'Heartburn' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Burping' })).toBeTruthy();
  });
});

describe('Usual symptoms: Add a symptom', () => {
  it('offers only the symptoms that are not on the list yet', async () => {
    setSetting(mockDb, 'usualSymptoms', ['heartburn', 'burping']);
    await render(<UsualSymptomsScreen />);

    await press('button', 'Add a symptom');

    expect(screen.getByRole('header', { name: 'Add a symptom' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Stomach pain' })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Heartburn' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Burping' })).toBeNull();
  });

  it('waits for a pick, then adds it to the list in catalog order and closes', async () => {
    setSetting(mockDb, 'usualSymptoms', ['burping']);
    await render(<UsualSymptomsScreen />);
    await press('button', 'Add a symptom');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();

    await press('checkbox', 'Heartburn');
    await press('checkbox', 'Stomach pain');
    await press('button', 'Add');

    expect(getSetting(mockDb, 'usualSymptoms')).toEqual(['heartburn', 'burping', 'stomach_pain']);
    expect(screen.queryByRole('checkbox', { name: 'Constipation' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Stomach pain' })).toBeTruthy();
  });

  it('says so when every symptom is already on the list', async () => {
    setSetting(
      mockDb,
      'usualSymptoms',
      BODY_ZONES.flatMap((zone) => zone.symptoms),
    );
    await render(<UsualSymptomsScreen />);

    await press('button', 'Add a symptom');

    expect(screen.getByText('They are all on your list.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
  });
});

describe('Usual symptoms: symptoms you typed yourself', () => {
  it('lists them after the chosen ones, each with the area it was added in', async () => {
    setSetting(mockDb, 'usualSymptoms', ['heartburn']);
    createSavedSymptom(mockDb, 'Jaw tightness', 'symptom', 'throat');
    createSavedSymptom(mockDb, 'Hiccups');
    createSavedSymptom(mockDb, 'Skipped breakfast', 'lifestyle'); // lifestyle lives on its own page
    await render(<UsualSymptomsScreen />);

    const names = screen
      .getAllByRole('button')
      .map((button) => button.props.accessibilityLabel as string)
      .filter((label) => ['Heartburn', 'Hiccups', 'Jaw tightness', 'Skipped breakfast'].includes(label));
    expect(names).toEqual(['Heartburn', 'Hiccups', 'Jaw tightness']);
    expect(screen.getByText('Other')).toBeTruthy(); // Hiccups: no area
    expect(screen.queryByText('No usual symptoms yet.')).toBeNull();
  });

  it('opens one to remove it, and entries already logged keep it', async () => {
    createSavedSymptom(mockDb, 'Hiccups');
    createSymptomLog(mockDb, { items: [{ key: 'custom:Hiccups' }] });
    await render(<UsualSymptomsScreen />);

    await press('button', 'Hiccups');
    await press('button', 'Remove');

    expect(listSavedSymptoms(mockDb, 'symptom')).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Hiccups' })).toBeNull();
    const logs = listSymptomLogs(mockDb, {
      from: '2000-01-01T00:00:00.000Z',
      to: '2100-01-01T00:00:00.000Z',
    });
    expect(logs[0]?.items).toEqual([{ key: 'custom:Hiccups', score: 1 }]);
  });
});
