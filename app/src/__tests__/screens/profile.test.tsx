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

    expect(screen.getByRole('header', { name: 'Your name' })).toBeTruthy();
    expect(screen.getByText('Just tracking for now')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add your name' })).toBeTruthy();
    expect(screen.getByText('Tap to pick the ones you usually feel.')).toBeTruthy();
  });

  it('shows the name, what you are managing, and your usual symptoms', async () => {
    setSetting(mockDb, 'userName', 'May');
    setSetting(mockDb, 'condition', 'acid_reflux');
    setSetting(mockDb, 'usualSymptoms', ['heartburn', 'burping']);
    await render(<ProfileScreen />);

    expect(screen.getByRole('header', { name: 'May' })).toBeTruthy();
    expect(screen.getByText('Managing acid reflux')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit name' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Condition, Acid reflux, change' })).toBeTruthy();
    expect(screen.getByText('Heartburn')).toBeTruthy();
    expect(screen.getByText('Burping')).toBeTruthy();
  });

  it('opens Settings from the gear', async () => {
    await render(<ProfileScreen />);

    await press('button', 'Settings');

    expect(mockPush).toHaveBeenCalledWith('/settings');
  });
});

describe('Profile: name', () => {
  it('saves the typed name, shows it, and closes the sheet', async () => {
    await render(<ProfileScreen />);
    await press('button', 'Add your name');

    await fireEvent.changeText(screen.getByLabelText('Your name'), '  May ');
    await press('button', 'Save');

    expect(getSetting(mockDb, 'userName')).toBe('May');
    expect(screen.getByRole('header', { name: 'May' })).toBeTruthy();
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
  it('lists the conditions with the current one marked', async () => {
    setSetting(mockDb, 'condition', 'acid_reflux');
    await render(<ProfileScreen />);
    await press('button', 'Condition, Acid reflux, change');

    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(5);
    expect(
      options.filter((o) => o.props.accessibilityState?.checked).map((o) => o.props.accessibilityLabel),
    ).toEqual(['Acid reflux, Heartburn, sour taste, burping']);
  });

  it('saves the chosen condition on tap, updates the Profile, and closes the sheet', async () => {
    setSetting(mockDb, 'condition', 'acid_reflux');
    await render(<ProfileScreen />);
    await press('button', 'Condition, Acid reflux, change');

    await press('radio', 'GERD, Frequent or long-term reflux');

    expect(getSetting(mockDb, 'condition')).toBe('gerd');
    expect(screen.getByText('Managing GERD')).toBeTruthy();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});

describe('Profile: usual symptoms', () => {
  it('starts from the saved symptoms and saves the new picks in catalog order', async () => {
    setSetting(mockDb, 'usualSymptoms', ['burping']);
    await render(<ProfileScreen />);
    await press('button', 'Usual symptoms, change');
    expect(screen.getByRole('checkbox', { name: 'Burping' }).props.accessibilityState.checked).toBe(true);

    await press('checkbox', 'Heartburn');
    await press('button', 'Save');

    expect(getSetting(mockDb, 'usualSymptoms')).toEqual(['heartburn', 'burping']);
    expect(screen.queryByRole('checkbox', { name: 'Heartburn' })).toBeNull();
  });

  it('can be emptied', async () => {
    setSetting(mockDb, 'usualSymptoms', ['burping']);
    await render(<ProfileScreen />);
    await press('button', 'Usual symptoms, change');

    await press('checkbox', 'Burping');
    await press('button', 'Save');

    expect(getSetting(mockDb, 'usualSymptoms')).toEqual([]);
    expect(screen.getByText('Tap to pick the ones you usually feel.')).toBeTruthy();
  });
});
