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

  it('has no back button, since Profile is a tab, but a gear at the top that opens Settings', async () => {
    await render(<ProfileScreen />);

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Settings' }));

    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('has two rows: About you, and Customize Bellie with how many gifts so far', async () => {
    await render(<ProfileScreen />);

    expect(screen.getByRole('button', { name: 'About you, What Bellie knows about you' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Customize Bellie, Gifts come with check-ins' })).toBeTruthy();
    // The six lists moved to About you.
    expect(screen.queryByRole('button', { name: 'Usual symptoms' })).toBeNull();
    expect(screen.queryByRole('header', { name: 'Your lists' })).toBeNull();
  });

  it('opens About you and Customize Bellie', async () => {
    await render(<ProfileScreen />);

    await press('button', 'About you, What Bellie knows about you');
    expect(mockPush).toHaveBeenLastCalledWith('/about-you');
    await press('button', 'Customize Bellie, Gifts come with check-ins');
    expect(mockPush).toHaveBeenLastCalledWith('/bellies-things');
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
