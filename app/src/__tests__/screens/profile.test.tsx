import { fireEvent, render, screen } from '@testing-library/react-native';

import ProfileScreen from '@/app/(tabs)/profile';
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
}));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockPush.mockClear();
});
afterEach(() => closeDb());

const press = async (role: 'button' | 'radio' | 'checkbox', name: string) =>
  fireEvent.press(screen.getByRole(role, { name }));

describe('Profile', () => {
  it('invites you to add a name on a fresh install', async () => {
    await render(<ProfileScreen />);

    expect(screen.getByRole('header', { name: 'Profile' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add your name' })).toBeTruthy();
    expect(screen.getByText('Add your name')).toBeTruthy();
  });

  it('shows the name, which is the way to edit it, with no separate Edit name button', async () => {
    setSetting(mockDb, 'userName', 'May');
    await render(<ProfileScreen />);

    expect(screen.getByText('May')).toBeTruthy();
    // One button for the name: its label says what it does, its value is the name.
    const name = screen.getByRole('button', { name: 'Edit name' });
    expect(name.props.accessibilityValue).toEqual({ text: 'May' });
    expect(screen.getAllByRole('button', { name: 'Edit name' })).toHaveLength(1);
  });

  it('has no back button or gear, since Profile is a tab', async () => {
    await render(<ProfileScreen />);

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
  });

  it('lists Condition, Usual symptoms, Favorite foods, Medications and Lifestyle under Your lists', async () => {
    await render(<ProfileScreen />);

    expect(screen.getByRole('header', { name: 'Your lists' })).toBeTruthy();
    const rows = screen
      .getAllByRole('button')
      .map((button) => button.props.accessibilityLabel)
      .filter((label) =>
        /^(Condition|Usual symptoms|Favorite foods|Medications|Lifestyle)$/.test(label ?? ''),
      );
    expect(rows).toEqual(['Condition', 'Usual symptoms', 'Favorite foods', 'Medications', 'Lifestyle']);
  });

  it('opens Favorite foods', async () => {
    await render(<ProfileScreen />);

    await press('button', 'Favorite foods');

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/log/food', params: { manage: '1' } });
  });

  it('opens Medications', async () => {
    await render(<ProfileScreen />);

    await press('button', 'Medications');

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/log/medication', params: { manage: '1' } });
  });

  it('opens Lifestyle', async () => {
    await render(<ProfileScreen />);

    await press('button', 'Lifestyle');

    expect(mockPush).toHaveBeenCalledWith('/lifestyle');
  });
});

describe('Profile: name', () => {
  it('saves the typed name, shows it, and closes the sheet', async () => {
    await render(<ProfileScreen />);
    await press('button', 'Add your name');

    await fireEvent.changeText(screen.getByLabelText('Your name'), '  May ');
    await press('button', 'Save');

    expect(getSetting(mockDb, 'userName')).toBe('May');
    expect(screen.getByText('May')).toBeTruthy();
    expect(screen.queryByLabelText('Your name')).toBeNull();
  });

  it('starts from the saved name and can clear it', async () => {
    setSetting(mockDb, 'userName', 'May');
    await render(<ProfileScreen />);
    await press('button', 'Edit name');
    expect(screen.getByLabelText('Your name').props.value).toBe('May');

    await fireEvent.changeText(screen.getByLabelText('Your name'), '');
    await press('button', 'Save');

    expect(getSetting(mockDb, 'userName')).toBe('');
    expect(screen.getByRole('button', { name: 'Add your name' })).toBeTruthy();
  });
});

describe('Profile: avatar', () => {
  it('offers the eight avatars with the current one marked', async () => {
    await render(<ProfileScreen />);
    await press('button', 'Change avatar');

    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(8);
    expect(
      options.filter((o) => o.props.accessibilityState?.checked).map((o) => o.props.accessibilityLabel),
    ).toEqual(['Your initial']);
  });

  it('saves the chosen avatar on tap, shows it, and closes the sheet', async () => {
    await render(<ProfileScreen />);
    await press('button', 'Change avatar');

    await press('radio', 'Coffee cup avatar');

    expect(getSetting(mockDb, 'avatar')).toBe('coffee');
    expect(screen.getByLabelText('Coffee cup avatar')).toBeTruthy();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});

describe('Profile: condition', () => {
  const change = 'Condition';

  it('lists the conditions with the current ones checked', async () => {
    setSetting(mockDb, 'conditions', ['acid_reflux']);
    await render(<ProfileScreen />);
    await press('button', change);

    const options = screen.getAllByRole('checkbox');
    expect(options).toHaveLength(4);
    expect(
      options.filter((o) => o.props.accessibilityState?.checked).map((o) => o.props.accessibilityLabel),
    ).toEqual(['Acid reflux or GERD, Heartburn, sour taste, burping']);
  });

  it('saves several conditions on Save, updates the Profile, and closes the sheet', async () => {
    setSetting(mockDb, 'conditions', ['acid_reflux']);
    await render(<ProfileScreen />);
    await press('button', change);

    await press('checkbox', 'Silent reflux (LPR), Hoarse voice, throat clearing');
    expect(getSetting(mockDb, 'conditions')).toEqual(['acid_reflux']);
    await press('button', 'Save');

    expect(getSetting(mockDb, 'conditions')).toEqual(['acid_reflux', 'lpr']);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('"Not sure yet" clears the rest, and picking a condition clears "Not sure yet"', async () => {
    setSetting(mockDb, 'conditions', ['acid_reflux', 'lpr']);
    await render(<ProfileScreen />);
    await press('button', 'Condition');

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

describe('Profile: usual symptoms', () => {
  it('opens the Usual symptoms page, not a sheet of every symptom', async () => {
    await render(<ProfileScreen />);

    await press('button', 'Usual symptoms');

    expect(mockPush).toHaveBeenCalledWith('/usual-symptoms');
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});
