import { fireEvent, render, screen } from '@testing-library/react-native';

import AboutYouScreen from '@/app/about-you';
import { createTestDb } from '@/db/__tests__/testDb';
import { getSetting, setSetting } from '@/db/repositories/settings';
import type { AppDb } from '@/db/types';

let mockDb: AppDb;
let closeDb: () => void;
const mockPush = jest.fn();

// A small stand-in for the real provider's settings hook, backed by the real repository. Like the
// real one, every caller shares the same settings: a save in a sheet re-renders the screen.
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
  router: {
    push: (href: string) => mockPush(href),
    back: jest.fn(),
    canGoBack: () => true,
    replace: jest.fn(),
  },
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
  mockPush.mockClear();
});
afterEach(() => closeDb());

// `prefix` finds a tile by its name alone: its label also carries how many are in it ("Medications, 1 added").
const press = async (role: 'button' | 'radio' | 'checkbox', name: string, prefix = false) =>
  fireEvent.press(screen.getByRole(role, { name: prefix ? new RegExp(`^${name}(,|$)`) : name }));

describe('About you', () => {
  it('shows six tiles, each an icon and a name, with no counts', async () => {
    await render(<AboutYouScreen />);

    expect(screen.getByRole('header', { name: 'About you' })).toBeTruthy();
    const tiles = screen.getAllByRole('button').map((button) => button.props.accessibilityLabel);
    expect(tiles).toEqual([
      expect.stringMatching(/^Back/),
      'Condition',
      'Usual symptoms',
      'Favorite foods',
      'Foods to avoid',
      'Medications',
      'Lifestyle factors',
    ]);
    expect(screen.queryByText(/added|saved|listed|tracked|None yet/)).toBeNull();
  });

  it('opens each list', async () => {
    await render(<AboutYouScreen />);

    await press('button', 'Usual symptoms', true);
    expect(mockPush).toHaveBeenLastCalledWith('/usual-symptoms');
    await press('button', 'Favorite foods', true);
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/log/food', params: { manage: '1' } });
    await press('button', 'Foods to avoid', true);
    expect(mockPush).toHaveBeenLastCalledWith('/avoid-foods');
    await press('button', 'Medications', true);
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/log/medication', params: { manage: '1' } });
    await press('button', 'Lifestyle factors', true);
    expect(mockPush).toHaveBeenLastCalledWith('/lifestyle');
  });
});

describe('About you: condition', () => {
  const change = 'Condition';

  it('lists the conditions with the current ones checked', async () => {
    setSetting(mockDb, 'conditions', ['acid_reflux']);
    await render(<AboutYouScreen />);
    await press('button', change, true);

    const options = screen.getAllByRole('checkbox');
    expect(options).toHaveLength(4);
    expect(
      options.filter((o) => o.props.accessibilityState?.checked).map((o) => o.props.accessibilityLabel),
    ).toEqual(['Acid reflux or GERD, Heartburn, sour taste, burping']);
  });

  it('saves several conditions on Save, updates the tile, and closes the sheet', async () => {
    setSetting(mockDb, 'conditions', ['acid_reflux']);
    await render(<AboutYouScreen />);
    await press('button', change, true);

    await press('checkbox', 'Silent reflux (LPR), Hoarse voice, throat clearing');
    expect(getSetting(mockDb, 'conditions')).toEqual(['acid_reflux']);
    await press('button', 'Save');

    expect(getSetting(mockDb, 'conditions')).toEqual(['acid_reflux', 'lpr']);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('"Not sure yet" clears the rest, and picking a condition clears "Not sure yet"', async () => {
    setSetting(mockDb, 'conditions', ['acid_reflux', 'lpr']);
    await render(<AboutYouScreen />);
    await press('button', 'Condition', true);

    const checked = () =>
      screen
        .getAllByRole('checkbox')
        .filter((o) => o.props.accessibilityState?.checked)
        .map((o) => o.props.accessibilityLabel.split(',')[0]);
    await press('checkbox', 'Not sure yet, Track first, decide later');
    expect(checked()).toEqual(['Not sure yet']);

    await press('checkbox', 'Gastritis, Stomach irritation, pain, feeling full');
    expect(checked()).toEqual(['Gastritis']);
    await press('button', 'Save');

    expect(getSetting(mockDb, 'conditions')).toEqual(['gastritis']);
  });
});
