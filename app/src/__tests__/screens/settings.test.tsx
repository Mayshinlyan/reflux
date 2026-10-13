import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import SettingsScreen from '@/app/settings';
import { createTestDb } from '@/db/__tests__/testDb';
import { createMedication, listMedications } from '@/db/repositories/medications';
import { getSetting, setSetting } from '@/db/repositories/settings';
import type { AppDb } from '@/db/types';

let mockDb: AppDb;
let closeDb: () => void;
const mockPush = jest.fn();
const mockToast = jest.fn();

// A small stand-in for the real provider's settings hook, backed by the real repository.
jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useState } = require('react');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const repo = require('@/db/repositories/settings');
    const [settings, setSettings] = useState(() => repo.getAllSettings(mockDb));
    return {
      settings,
      reload: () => setSettings(repo.getAllSettings(mockDb)),
      update: (key: string, value: unknown) => {
        repo.setSetting(mockDb, key, value);
        setSettings(repo.getAllSettings(mockDb));
      },
    };
  },
}));
// Sentry's SDK starts a cleanup timer on import; not needed here.
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('@/components/Toast', () => ({ useToast: () => mockToast }));
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
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));
const mockDeleteAllPhotos = jest.fn();
jest.mock('@/services/photoStore', () => ({ deleteAllPhotos: () => mockDeleteAllPhotos() }));

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockPush.mockClear();
  mockToast.mockClear();
  mockDeleteAllPhotos.mockReset();
});
afterEach(() => closeDb());

const press = async (role: 'button' | 'radio', name: string) =>
  fireEvent.press(screen.getByRole(role, { name }));

describe('Settings', () => {
  it('shows the current bedtime and late-meal window, with the defaults on a fresh install', async () => {
    await render(<SettingsScreen />);

    expect(screen.getByRole('header', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bedtime, 10:30 PM' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Late-meal window, 3 hours' })).toBeTruthy();
  });

  it('groups the rows as Figma does, with no condition row and no pet', async () => {
    await render(<SettingsScreen />);

    expect(screen.getAllByRole('header').map((h) => h.props.children ?? h.props.accessibilityLabel)).toEqual(
      expect.arrayContaining(['Preferences', 'Your lists', 'About']),
    );
    const rows = screen
      .getAllByRole('button')
      .map((button) => button.props.accessibilityLabel)
      .filter((label) => /^(Bedtime|Late-meal|Condition|My |Privacy|Delete)/.test(label ?? ''));
    expect(rows).toEqual([
      'Bedtime, 10:30 PM',
      'Late-meal window, 3 hours',
      'My foods',
      'My medications',
      'My symptoms',
      'Privacy and disclaimer',
      'Delete all my data',
    ]);
  });

  it('opens My medications', async () => {
    await render(<SettingsScreen />);

    await press('button', 'My medications');

    expect(mockPush.mock.calls).toEqual([[{ pathname: '/log/medication', params: { manage: '1' } }]]);
  });

  it('opens My symptoms', async () => {
    await render(<SettingsScreen />);

    await press('button', 'My symptoms');

    expect(mockPush.mock.calls).toEqual([['/my-symptoms']]);
  });
});

describe('Settings: late-meal window', () => {
  it('offers 1 to 4 hours with the current window marked', async () => {
    await render(<SettingsScreen />);
    await press('button', 'Late-meal window, 3 hours');

    const options = screen.getAllByRole('radio');
    expect(options.map((o) => o.props.accessibilityLabel)).toEqual([
      '1 hour',
      '2 hours',
      '3 hours',
      '4 hours',
    ]);
    expect(
      options.filter((o) => o.props.accessibilityState?.checked).map((o) => o.props.accessibilityLabel),
    ).toEqual(['3 hours']);
  });

  it('saves the chosen window, shows it, and closes the list', async () => {
    await render(<SettingsScreen />);
    await press('button', 'Late-meal window, 3 hours');

    await press('radio', '2 hours');

    expect(getSetting(mockDb, 'lateMealWindowMinutes')).toBe(120);
    expect(screen.getByRole('button', { name: 'Late-meal window, 2 hours' })).toBeTruthy();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});

describe('Settings: privacy and disclaimer', () => {
  it('shows where data lives and that this is not medical advice', async () => {
    await render(<SettingsScreen />);

    await press('button', 'Privacy and disclaimer');

    expect(screen.getByText('Stored on your phone')).toBeTruthy();
    expect(screen.getByText('Meal checks use AI')).toBeTruthy();
    expect(screen.getByText('Not medical advice')).toBeTruthy();
  });
});

describe('Settings: bedtime', () => {
  it('offers 8:00 PM to 2:00 AM with the current bedtime marked', async () => {
    await render(<SettingsScreen />);
    await press('button', 'Bedtime, 10:30 PM');

    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(13);
    expect(options[0]?.props.accessibilityLabel).toBe('8:00 PM');
    expect(options.at(-1)?.props.accessibilityLabel).toBe('2:00 AM');
    expect(
      options.filter((o) => o.props.accessibilityState?.checked).map((o) => o.props.accessibilityLabel),
    ).toEqual(['10:30 PM']);
  });

  it('saves the chosen bedtime, shows it, and closes the list', async () => {
    await render(<SettingsScreen />);
    await press('button', 'Bedtime, 10:30 PM');

    await press('radio', '11:00 PM');

    expect(getSetting(mockDb, 'bedtime')).toBe('23:00');
    expect(screen.getByRole('button', { name: 'Bedtime, 11:00 PM' })).toBeTruthy();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('can be set after midnight', async () => {
    await render(<SettingsScreen />);
    await press('button', 'Bedtime, 10:30 PM');

    await press('radio', '12:30 AM');

    expect(getSetting(mockDb, 'bedtime')).toBe('00:30');
    expect(screen.getByRole('button', { name: 'Bedtime, 12:30 AM' })).toBeTruthy();
  });

  it('starts from a bedtime saved earlier', async () => {
    setSetting(mockDb, 'bedtime', '21:30');
    await render(<SettingsScreen />);

    expect(screen.getByRole('button', { name: 'Bedtime, 9:30 PM' })).toBeTruthy();
  });
});

describe('Settings: delete all my data', () => {
  const pressAlertButton = (spy: jest.SpyInstance, text: string) => {
    const buttons = spy.mock.calls.at(-1)?.[2] as AlertButton[];
    buttons.find((button) => button.text === text)?.onPress?.();
  };

  afterEach(() => jest.restoreAllMocks());

  it('asks first, and Cancel leaves everything alone', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    createMedication(mockDb, { name: 'Omeprazole', type: 'ppi' });
    await render(<SettingsScreen />);

    await press('button', 'Delete all my data');
    expect(alert.mock.calls.at(-1)?.[0]).toBe('Delete all your data?');
    pressAlertButton(alert, 'Cancel');

    expect(listMedications(mockDb)).toHaveLength(1);
    expect(mockDeleteAllPhotos).not.toHaveBeenCalled();
  });

  it('deletes the data and photos, keeps onboarding done, and confirms', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    createMedication(mockDb, { name: 'Omeprazole', type: 'ppi' });
    setSetting(mockDb, 'onboardingDone', true);
    await render(<SettingsScreen />);

    await press('button', 'Delete all my data');
    await act(async () => pressAlertButton(alert, 'Delete everything'));

    expect(listMedications(mockDb)).toHaveLength(0);
    expect(mockDeleteAllPhotos).toHaveBeenCalledTimes(1);
    expect(getSetting(mockDb, 'onboardingDone')).toBe(true);
    expect(mockToast).toHaveBeenCalledWith('All your data was deleted');
  });

  it('still reports success if a leftover photo file cannot be removed', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockDeleteAllPhotos.mockImplementation(() => {
      throw new Error('EACCES /private/photos');
    });
    await render(<SettingsScreen />);

    await press('button', 'Delete all my data');
    await act(async () => pressAlertButton(alert, 'Delete everything'));

    expect(mockToast).toHaveBeenCalledWith('All your data was deleted');
  });
});
