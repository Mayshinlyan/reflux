import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import SettingsScreen from '@/app/settings';
import { createTestDb } from '@/db/__tests__/testDb';
import { createMedication, listMedications } from '@/db/repositories/medications';
import { getAllSettings, getSetting, setSetting } from '@/db/repositories/settings';
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
  it('shows the current pet name and bedtime, with the defaults on a fresh install', async () => {
    await render(<SettingsScreen />);

    expect(screen.getByRole('button', { name: 'My pet, Mochi' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bedtime, 10:30 PM' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'My medications' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Your Logs' })).toBeTruthy();
  });

  it('groups bedtime, pet, foods and medications under Personalize, bedtime first', async () => {
    await render(<SettingsScreen />);

    expect(screen.getByRole('header', { name: 'Personalize' })).toBeTruthy();
    const rows = screen
      .getAllByRole('button')
      .map((button) => button.props.accessibilityLabel)
      .filter((label) => /^(Bedtime|My pet|My foods|My medications)/.test(label ?? ''));
    expect(rows).toEqual(['Bedtime, 10:30 PM', 'My pet, Mochi', 'My foods', 'My medications']);
  });

  it('opens Your Logs and My medications', async () => {
    await render(<SettingsScreen />);

    await press('button', 'Your Logs');
    await press('button', 'My medications');

    expect(mockPush.mock.calls).toEqual([['/history'], ['/log/medication']]);
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

describe('Settings: my pet', () => {
  it('opens with the current name and saves a new one, trimmed', async () => {
    await render(<SettingsScreen />);
    await press('button', 'My pet, Mochi');

    expect(screen.getByLabelText('Name').props.value).toBe('Mochi');
    await fireEvent.changeText(screen.getByLabelText('Name'), '  Biscuit ');
    await press('button', 'Save');

    expect(getAllSettings(mockDb).petName).toBe('Biscuit');
    expect(screen.getByRole('button', { name: 'My pet, Biscuit' })).toBeTruthy();
    expect(mockToast).toHaveBeenCalledWith('Name saved');
  });

  it('will not save a blank name', async () => {
    await render(<SettingsScreen />);
    await press('button', 'My pet, Mochi');
    await fireEvent.changeText(screen.getByLabelText('Name'), '   ');

    expect(screen.getByRole('button', { name: 'Save' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(getAllSettings(mockDb).petName).toBe('Mochi');
  });

  it('always starts from the saved name, not a half-typed one from last time', async () => {
    await render(<SettingsScreen />);
    await press('button', 'My pet, Mochi');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Halfway');
    await fireEvent.press(screen.getByRole('button', { name: 'Close', includeHiddenElements: true })); // dismiss without saving

    await press('button', 'My pet, Mochi');

    expect(screen.getByLabelText('Name').props.value).toBe('Mochi');
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

  it('deletes the data and photos, resets the pet, and confirms', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    createMedication(mockDb, { name: 'Omeprazole', type: 'ppi' });
    setSetting(mockDb, 'onboardingDone', true);
    setSetting(mockDb, 'petName', 'Biscuit');
    await render(<SettingsScreen />);
    expect(screen.getByRole('button', { name: 'My pet, Biscuit' })).toBeTruthy();

    await press('button', 'Delete all my data');
    await act(async () => pressAlertButton(alert, 'Delete everything'));

    expect(listMedications(mockDb)).toHaveLength(0);
    expect(mockDeleteAllPhotos).toHaveBeenCalledTimes(1);
    expect(getSetting(mockDb, 'onboardingDone')).toBe(true);
    expect(screen.getByRole('button', { name: 'My pet, Mochi' })).toBeTruthy();
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
