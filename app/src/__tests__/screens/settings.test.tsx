import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { Alert, type AlertButton, Linking } from 'react-native';

import SettingsScreen from '@/app/(tabs)/settings';
import { createTestDb } from '@/db/__tests__/testDb';
import { createMedication, listMedications } from '@/db/repositories/medications';
import { getSetting, setSetting } from '@/db/repositories/settings';
import type { AppDb } from '@/db/types';

let mockDb: AppDb;
let closeDb: () => void;
const mockPush = jest.fn();
const mockReplace = jest.fn();
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
// Reanimated's native runtime can't load in Jest; use its mocks (which lack useReducedMotion).
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
const mockReplay = jest.fn();
const mockNavigate = jest.fn();
jest.mock('@/components/tour/TourContext', () => ({ useTour: () => ({ replay: mockReplay }) }));
jest.mock('expo-router', () => ({
  router: {
    push: (href: string) => mockPush(href),
    navigate: (href: string) => mockNavigate(href),
    back: jest.fn(),
    canGoBack: () => true,
    replace: (href: string) => mockReplace(href),
  },
}));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));
const mockDeleteAllPhotos = jest.fn();
jest.mock('@/services/photoStore', () => ({ deleteAllPhotos: () => mockDeleteAllPhotos() }));
const mockSendFeedback = jest.fn();
jest.mock('@/services/relayClient', () => ({ sendFeedback: (message: string) => mockSendFeedback(message) }));

beforeEach(() => {
  jest.clearAllMocks();
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockPush.mockClear();
  mockReplace.mockClear();
  mockToast.mockClear();
  mockDeleteAllPhotos.mockReset();
  mockSendFeedback.mockReset();
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

  it('groups the rows as Figma does, with no condition row, no pet and no lists (they live in Profile)', async () => {
    await render(<SettingsScreen />);

    expect(screen.getAllByRole('header').map((h) => h.props.children ?? h.props.accessibilityLabel)).toEqual(
      expect.arrayContaining(['Preferences', 'About']),
    );
    const rows = screen
      .getAllByRole('button')
      .map((button) => button.props.accessibilityLabel)
      .filter((label) =>
        /^(Bedtime|Late-meal|Check-in|Bellie|Condition|Favorite|Medications|Symptoms|My |Replay|Send|Privacy|Delete)/.test(
          label ?? '',
        ),
      );
    expect(rows).toEqual([
      'Bedtime, 10:30 PM',
      'Late-meal window, 3 hours',
      'Check-in reminder, Off',
      "Bellie's summaries, On",
      'Replay app tour',
      'Send feedback',
      'Privacy and disclaimer',
      'Delete all my data',
    ]);
  });

  it('replays the app tour from Today', async () => {
    await render(<SettingsScreen />);

    await press('button', 'Replay app tour');

    // Asks for the tour, then goes to Today, which starts it once it is on screen.
    expect(mockReplay).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});

describe('Settings: send feedback', () => {
  it('sends what was typed, then closes the sheet with a thank-you toast', async () => {
    mockSendFeedback.mockResolvedValue(undefined);
    await render(<SettingsScreen />);

    await press('button', 'Send feedback');
    expect(screen.getByRole('header', { name: 'Send feedback' })).toBeTruthy();
    await fireEvent.changeText(
      screen.getByPlaceholderText("What's working? What could be better?"),
      '  A weekly summary, please  ',
    );
    await press('button', 'Send');

    expect(mockSendFeedback).toHaveBeenCalledWith('A weekly summary, please');
    expect(mockToast).toHaveBeenCalledWith('Thanks, Bellie got it');
  });

  it('keeps the sheet open and the text when sending fails, and shows no toast', async () => {
    mockSendFeedback.mockRejectedValue(new Error('boom'));
    await render(<SettingsScreen />);

    await press('button', 'Send feedback');
    await fireEvent.changeText(screen.getByPlaceholderText("What's working? What could be better?"), 'Hi');
    await press('button', 'Send');

    expect(screen.getByText("We couldn't send that. Please try again.")).toBeTruthy();
    expect(screen.getByDisplayValue('Hi')).toBeTruthy();
    expect(mockToast).not.toHaveBeenCalled();
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

describe("Settings: Bellie's summaries", () => {
  it('are on until turned off, and the choice says what is sent', async () => {
    await render(<SettingsScreen />);
    await press('button', "Bellie's summaries, On");

    const options = screen.getAllByRole('radio');
    expect(options.map((o) => o.props.accessibilityLabel)).toEqual(['On', 'Off']);
    expect(
      options.filter((o) => o.props.accessibilityState?.checked).map((o) => o.props.accessibilityLabel),
    ).toEqual(['On']);
    expect(screen.getByText(/your meals, symptoms and conditions are sent to an AI service/)).toBeTruthy();
  });

  it('saves Off, shows it, and closes the list', async () => {
    await render(<SettingsScreen />);
    await press('button', "Bellie's summaries, On");

    await press('radio', 'Off');

    expect(getSetting(mockDb, 'summariesEnabled')).toBe(false);
    expect(screen.getByRole('button', { name: "Bellie's summaries, Off" })).toBeTruthy();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('can be turned back on', async () => {
    setSetting(mockDb, 'summariesEnabled', false);
    await render(<SettingsScreen />);
    await press('button', "Bellie's summaries, Off");

    await press('radio', 'On');

    expect(getSetting(mockDb, 'summariesEnabled')).toBe(true);
  });
});

describe('Settings: privacy and disclaimer', () => {
  it('shows where data lives and that this is not medical advice', async () => {
    await render(<SettingsScreen />);

    await press('button', 'Privacy and disclaimer');

    expect(screen.getByText('Stored on your phone')).toBeTruthy();
    expect(screen.getByText('Meal checks and summaries use AI')).toBeTruthy();
    // What is sent, and what is not, in a few plain words.
    expect(
      screen.getByText(
        /we send your meal photos or descriptions, symptoms, lifestyle tags and conditions to an AI service/,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/along with anything you type when checking a meal/)).toBeTruthy();
    expect(
      screen.getByText(/The notes on your entries, your medications and your name stay on your phone/),
    ).toBeTruthy();
    expect(screen.getByText(/If you send feedback, the message is kept without your name/)).toBeTruthy();
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

describe('Settings: check-in reminder', () => {
  const mocked = jest.mocked(Notifications);
  const turnOnAt = async (label: string) => {
    await press('button', 'Check-in reminder, Off');
    await act(async () => {
      fireEvent.press(screen.getByRole('radio', { name: label }));
    });
  };

  it('is off until chosen', async () => {
    await render(<SettingsScreen />);

    expect(screen.getByRole('button', { name: 'Check-in reminder, Off' })).toBeTruthy();
  });

  it('offers Off and one to three hours after a meal, with the current choice marked', async () => {
    await render(<SettingsScreen />);
    await press('button', 'Check-in reminder, Off');

    const options = screen.getAllByRole('radio');
    expect(options.map((o) => o.props.accessibilityLabel)).toEqual([
      'Off',
      '1 hour after a meal',
      '2 hours after a meal',
      '3 hours after a meal',
    ]);
    expect(
      options.filter((o) => o.props.accessibilityState?.checked).map((o) => o.props.accessibilityLabel),
    ).toEqual(['Off']);
    expect(
      screen.getByText('This reminder is set on your phone. Nothing about it is sent anywhere.'),
    ).toBeTruthy();
  });

  it('turns it on once the phone allows it, saves the time, marks it asked, and closes the sheet', async () => {
    await render(<SettingsScreen />);

    await turnOnAt('2 hours after a meal');

    expect(getSetting(mockDb, 'checkInReminderMinutes')).toBe(120);
    expect(getSetting(mockDb, 'reminderAsked')).toBe(true);
    expect(screen.getByRole('button', { name: 'Check-in reminder, 2 hours' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: '1 hour after a meal' })).toBeNull();
  });

  it('turns it off, drops every pending reminder, and still counts as asked', async () => {
    setSetting(mockDb, 'checkInReminderMinutes', 120);
    await render(<SettingsScreen />);
    await press('button', 'Check-in reminder, 2 hours');

    await act(async () => {
      fireEvent.press(screen.getByRole('radio', { name: 'Off' }));
    });

    expect(getSetting(mockDb, 'checkInReminderMinutes')).toBeNull();
    expect(getSetting(mockDb, 'reminderAsked')).toBe(true);
    expect(mocked.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Check-in reminder, Off' })).toBeTruthy();
  });

  it('stays off and explains when the phone is blocking notifications, with a way to the phone settings', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    mocked.getPermissionsAsync.mockResolvedValueOnce({ granted: false } as never);
    mocked.requestPermissionsAsync.mockResolvedValueOnce({ granted: false } as never);
    await render(<SettingsScreen />);

    await turnOnAt('1 hour after a meal');

    expect(getSetting(mockDb, 'checkInReminderMinutes')).toBeNull();
    expect(getSetting(mockDb, 'reminderAsked')).toBe(false);
    expect(screen.getByText(/Notifications are off for this app/)).toBeTruthy();

    await press('button', 'Open Settings');
    expect(openSettings).toHaveBeenCalledTimes(1);
    openSettings.mockRestore();
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

  it('says everything it erases, including that Bellie is set up again', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<SettingsScreen />);

    await press('button', 'Delete all my data');

    const message = alert.mock.calls.at(-1)?.[1] as string;
    expect(message).toContain('favorite foods');
    expect(message).toContain('your name and your settings');
    expect(message).toContain("You'll set Bellie up again afterwards");
  });

  it('deletes the data, photos and settings, starts again at the welcome, and confirms', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    createMedication(mockDb, { name: 'Omeprazole', type: 'ppi' });
    setSetting(mockDb, 'onboardingDone', true);
    setSetting(mockDb, 'userName', 'May');
    await render(<SettingsScreen />);

    await press('button', 'Delete all my data');
    await act(async () => pressAlertButton(alert, 'Delete everything'));

    expect(listMedications(mockDb)).toHaveLength(0);
    expect(mockDeleteAllPhotos).toHaveBeenCalledTimes(1);
    expect(getSetting(mockDb, 'onboardingDone')).toBe(false);
    expect(getSetting(mockDb, 'userName')).toBe('');
    expect(mockReplace).toHaveBeenCalledWith('/welcome');
    expect(mockToast).toHaveBeenCalledWith('All your data was deleted');
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
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
