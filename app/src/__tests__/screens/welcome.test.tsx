import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import WelcomeScreen from '@/app/welcome';
import { createTestDb } from '@/db/__tests__/testDb';
import { listMedications } from '@/db/repositories/medications';
import type { AppDb } from '@/db/types';

let mockDb: AppDb;
let closeDb: () => void;
let mockSettings: Record<string, unknown> = {};
const mockUpdate = jest.fn();
const mockReplace = jest.fn();
const mockSignIn = jest.fn(() => Promise.resolve());

jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => ({
    settings: { ...jest.requireActual('@/db/repositories/settings').DEFAULT_SETTINGS, ...mockSettings },
    update: mockUpdate,
  }),
}));
jest.mock('@/services/firebase', () => ({ ensureAnonymousSession: () => mockSignIn() }));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  router: { replace: (href: string) => mockReplace(href), back: jest.fn(), canGoBack: () => true },
}));

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockSettings = {};
  mockUpdate.mockReset();
  mockReplace.mockReset();
  mockSignIn.mockClear();
  jest.mocked(Notifications.getPermissionsAsync).mockClear();
  jest.mocked(Notifications.requestPermissionsAsync).mockClear();
});

afterEach(() => closeDb());

const press = async (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
const pick = async (role: 'checkbox' | 'radio', name: string) =>
  fireEvent.press(screen.getByRole(role, { name }));

/** Walks from the greeting to the first setup question. */
async function toCondition() {
  await press('Get started');
  await press('Continue');
}

describe('Welcome', () => {
  it('starts on the greeting with no back button and step 1 of 7', async () => {
    await render(<WelcomeScreen />);

    expect(screen.getByRole('header', { name: "Let's see how your belly feels." })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.getByRole('progressbar', { name: 'Step 1 of 7' })).toBeTruthy();
  });

  it('introduces Bellie on the second step, and Back returns to the greeting', async () => {
    await render(<WelcomeScreen />);
    await press('Get started');

    expect(screen.getByText("Hi there! I'm Bellie!")).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Step 2 of 7' })).toBeTruthy();

    await press('Back');
    expect(screen.getByRole('header', { name: "Let's see how your belly feels." })).toBeTruthy();
  });

  it('saves each answer as they continue, then ends on a celebration without dots', async () => {
    await render(<WelcomeScreen />);
    await toCondition();

    expect(screen.getByRole('header', { name: 'What would you like to manage?' })).toBeTruthy();
    await pick('checkbox', 'Silent reflux (LPR), Hoarse voice, throat clearing');
    await pick('checkbox', 'Acid reflux or GERD, Heartburn, sour taste, burping');
    await press('Continue');
    // Saved in catalog order, not tap order.
    expect(mockUpdate).toHaveBeenCalledWith('conditions', ['acid_reflux', 'lpr']);

    expect(screen.getByRole('header', { name: 'What do you usually feel?' })).toBeTruthy();
    await pick('checkbox', 'Heartburn');
    await pick('checkbox', 'Hoarse voice');
    await press('Continue');
    // Saved in catalog order, not tap order.
    expect(mockUpdate).toHaveBeenCalledWith('usualSymptoms', ['hoarseness', 'heartburn']);

    expect(screen.getByRole('header', { name: 'When do you usually go to bed?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bedtime, 10:30 PM' })).toBeTruthy();
    await press('Bedtime, 10:30 PM');
    await pick('radio', '9:00 PM');
    expect(screen.getByRole('button', { name: 'Bedtime, 9:00 PM' })).toBeTruthy();
    await press('Late meal window, 3 hours before bed');
    await pick('radio', '2 hours before bed');
    await press('Continue');
    expect(mockUpdate).toHaveBeenCalledWith('bedtime', '21:00');
    expect(mockUpdate).toHaveBeenCalledWith('lateMealWindowMinutes', 120);

    expect(screen.getByRole('header', { name: 'Do you take any medication?' })).toBeTruthy();
    await pick('checkbox', 'Omeprazole 20mg, PPI');
    await press('Continue');
    expect(listMedications(mockDb).map((med) => [med.name, med.defaultDose, med.type])).toEqual([
      ['Omeprazole', '20mg', 'ppi'],
    ]);

    expect(screen.getByRole('header', { name: 'Your diary stays with you.' })).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Step 7 of 7' })).toBeTruthy();
    await press('Continue');

    // The reminders offer sits between Privacy and Ready, with no dots.
    expect(screen.getByRole('header', { name: 'Want a gentle nudge?' })).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
    await press('Maybe later');

    expect(screen.getByText('Ready when you are!')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalledWith('onboardingDone', true);

    await press('Start logging');
    await act(async () => {});

    expect(mockUpdate).toHaveBeenCalledWith('onboardingDone', true);
    expect(mockSignIn).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  describe('reminders step', () => {
    async function toReminders() {
      await render(<WelcomeScreen />);
      await toCondition();
      await press('Continue');
      await press('Skip');
      await press('Continue');
      await press('Skip for now');
      await press('Continue');
      expect(screen.getByRole('header', { name: 'Want a gentle nudge?' })).toBeTruthy();
    }

    it('previews the reminder and says it stays on the phone', async () => {
      await toReminders();

      expect(screen.getByText('How are you feeling?')).toBeTruthy();
      expect(screen.getByText(/stays on your phone/)).toBeTruthy();
    });

    it('turns it on at two hours and marks it asked once the phone allows it', async () => {
      await toReminders();
      await press('Turn on notifications');
      await act(async () => {});

      expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith('reminderAsked', true);
      expect(mockUpdate).toHaveBeenCalledWith('checkInReminderMinutes', 120);
      expect(screen.getByText('Ready when you are!')).toBeTruthy();
    });

    it('marks it asked but leaves it off when the phone says no', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
      await toReminders();
      await press('Turn on notifications');
      await act(async () => {});

      expect(mockUpdate).toHaveBeenCalledWith('reminderAsked', true);
      expect(mockUpdate).not.toHaveBeenCalledWith('checkInReminderMinutes', expect.anything());
      expect(screen.getByText('Ready when you are!')).toBeTruthy();
    });

    it('"Maybe later" saves nothing, so the one-time sheet can still offer it', async () => {
      await toReminders();
      await press('Maybe later');

      expect(mockUpdate).not.toHaveBeenCalledWith('reminderAsked', expect.anything());
      expect(mockUpdate).not.toHaveBeenCalledWith('checkInReminderMinutes', expect.anything());
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
      expect(screen.getByText('Ready when you are!')).toBeTruthy();
    });
  });

  it('starts the usual symptoms from the chosen conditions', async () => {
    mockSettings = { conditions: ['acid_reflux'] };
    await render(<WelcomeScreen />);
    await toCondition();
    await press('Continue');

    const checked = (name: string) => screen.getByRole('checkbox', { name }).props.accessibilityState.checked;
    expect(checked('Heartburn')).toBe(true);
    expect(checked('Burping')).toBe(true);
    expect(checked('Hoarse voice')).toBe(false);
  });

  it('lets them skip the usual symptoms and the medications without saving anything', async () => {
    await render(<WelcomeScreen />);
    await toCondition();
    await press('Continue');

    await pick('checkbox', 'Heartburn');
    await press('Skip');
    expect(mockUpdate).not.toHaveBeenCalledWith('usualSymptoms', expect.anything());

    expect(screen.getByRole('header', { name: 'When do you usually go to bed?' })).toBeTruthy();
    await press('Continue');
    await pick('checkbox', 'Tums, Antacid');
    await press('Skip for now');

    expect(listMedications(mockDb)).toEqual([]);
    expect(screen.getByRole('header', { name: 'Your diary stays with you.' })).toBeTruthy();
  });

  it('keeps a medication picked earlier, without duplicating it, when they come back', async () => {
    await render(<WelcomeScreen />);
    await toCondition();
    await press('Continue');
    await press('Skip');
    await press('Continue');

    await pick('checkbox', 'Gaviscon, Alginate');
    await press('Continue');
    await press('Back');

    expect(
      screen.getByRole('checkbox', { name: 'Gaviscon, Alginate' }).props.accessibilityState,
    ).toMatchObject({
      checked: true,
    });
    await press('Continue');
    expect(listMedications(mockDb)).toHaveLength(1);

    // Going back and unpicking removes it from the list.
    await press('Back');
    await pick('checkbox', 'Gaviscon, Alginate');
    await press('Continue');
    expect(listMedications(mockDb)).toEqual([]);
  });
});
