import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import WelcomeScreen from '@/app/welcome';
import { createTestDb } from '@/db/__tests__/testDb';
import type { AppDb } from '@/db/types';

let mockDb: AppDb;
let closeDb: () => void;
let mockSettings: Record<string, unknown> = {};
const mockUpdate = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
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
  router: {
    replace: (href: string) => mockReplace(href),
    push: (href: string) => mockPush(href),
    back: jest.fn(),
    canGoBack: () => true,
  },
}));

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockSettings = {};
  mockUpdate.mockReset();
  mockReplace.mockReset();
  mockPush.mockReset();
  mockSignIn.mockClear();
  jest.mocked(Notifications.getPermissionsAsync).mockClear();
  jest.mocked(Notifications.requestPermissionsAsync).mockClear();
});

afterEach(() => closeDb());

const press = async (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
const pick = async (role: 'checkbox' | 'radio' | 'button', name: string) =>
  fireEvent.press(screen.getByRole(role, { name }));
const header = (name: string) => screen.getByRole('header', { name });
const bar = (step: number) => screen.getByRole('progressbar', { name: `Step ${step} of 5` });

const HELLO = "Hi, I'm Bellie! Let's see how your belly feels.";
const READY = 'Ready when you are!';
const CONDITION_ACID = 'Burning in my chest, Acid reflux or GERD';
const CONDITION_LPR = 'Hoarse voice, throat clearing, Silent reflux (LPR)';
const CONDITION_UNSURE = "I'm not sure yet, We'll learn it together";

/** Walks from the greeting to the first setup question. */
async function toCondition() {
  await press('Get started');
  await press('Continue'); // How it works
}

/** Answers condition and skips symptoms, landing on Privacy. */
async function toPrivacy() {
  await toCondition();
  await pick('checkbox', CONDITION_ACID);
  await press('Continue');
  await press('Skip for now'); // symptoms
  expect(header('Your diary stays with you.')).toBeTruthy();
}

/** Continues from Privacy to the reminder timing question. */
async function toReminders() {
  await toPrivacy();
  await press('Continue');
  expect(header('When should Bellie check in?')).toBeTruthy();
}

describe('Welcome', () => {
  it('starts on Bellie saying hello, with no back button and no progress bar', async () => {
    await render(<WelcomeScreen />);

    expect(header(HELLO)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('shows how logging works and an example pattern on one screen, both marked as examples', async () => {
    await render(<WelcomeScreen />);
    await press('Get started');

    expect(header('Log a meal. Spot the patterns.')).toBeTruthy();
    expect(bar(1)).toBeTruthy();
    expect(screen.getByLabelText(/Example: a photo of your meal/)).toBeTruthy();
    expect(screen.getByLabelText(/Example: Spicy meals/)).toBeTruthy();

    await press('Back');
    expect(screen.getByText(HELLO)).toBeTruthy();
  });

  describe('condition step', () => {
    it('starts with nothing picked and waits for a choice', async () => {
      await render(<WelcomeScreen />);
      await toCondition();

      expect(header("What's bothering you?")).toBeTruthy();
      expect(bar(2)).toBeTruthy();
      for (const name of [CONDITION_ACID, CONDITION_LPR, CONDITION_UNSURE]) {
        expect(screen.getByRole('checkbox', { name }).props.accessibilityState).toMatchObject({
          checked: false,
        });
      }
      expect(screen.getByRole('button', { name: 'Continue' }).props.accessibilityState).toMatchObject({
        disabled: true,
      });
    });

    it('saves what they pick in card order, and "not sure yet" clears the others', async () => {
      await render(<WelcomeScreen />);
      await toCondition();

      await pick('checkbox', CONDITION_LPR);
      await pick('checkbox', CONDITION_ACID);
      await press('Continue');
      expect(mockUpdate).toHaveBeenCalledWith('conditions', ['acid_reflux', 'lpr']);

      await press('Back');
      // Coming back shows what they chose; "not sure yet" replaces it.
      expect(screen.getByRole('checkbox', { name: CONDITION_LPR }).props.accessibilityState).toMatchObject({
        checked: true,
      });
      await pick('checkbox', CONDITION_UNSURE);
      expect(screen.getByRole('checkbox', { name: CONDITION_LPR }).props.accessibilityState).toMatchObject({
        checked: false,
      });
      await press('Continue');
      expect(mockUpdate).toHaveBeenLastCalledWith('conditions', ['unsure']);
    });
  });

  describe('usual symptoms step', () => {
    it('starts with nothing picked, even once a condition is chosen', async () => {
      mockSettings = { conditions: ['acid_reflux'] };
      await render(<WelcomeScreen />);
      await toCondition();
      await pick('checkbox', CONDITION_ACID);
      await press('Continue');

      expect(header('What do you usually feel?')).toBeTruthy();
      expect(bar(3)).toBeTruthy();
      expect(screen.getByRole('checkbox', { name: 'Heartburn' }).props.accessibilityState).toMatchObject({
        checked: false,
      });
    });

    it('offers "Skip for now" until something is picked, then "Continue"', async () => {
      await render(<WelcomeScreen />);
      await toCondition();
      await pick('checkbox', CONDITION_ACID);
      await press('Continue');

      expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
      await pick('checkbox', 'Heartburn');
      expect(screen.queryByRole('button', { name: 'Skip for now' })).toBeNull();
      await pick('checkbox', 'Hoarse voice');
      await press('Continue');

      // Saved in catalog order, not tap order.
      expect(mockUpdate).toHaveBeenCalledWith('usualSymptoms', ['hoarseness', 'heartburn']);
      expect(header('Your diary stays with you.')).toBeTruthy();
    });

    it('saves nothing when they skip', async () => {
      await render(<WelcomeScreen />);
      await toCondition();
      await pick('checkbox', CONDITION_ACID);
      await press('Continue');
      await press('Skip for now');

      expect(mockUpdate).not.toHaveBeenCalledWith('usualSymptoms', expect.anything());
      expect(header('Your diary stays with you.')).toBeTruthy();
    });
  });

  it('no longer asks for a bedtime or medications', async () => {
    await render(<WelcomeScreen />);
    await toPrivacy();

    expect(screen.queryByText('When do you usually go to bed?')).toBeNull();
    expect(screen.queryByText('Do you take any medication?')).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalledWith('bedtime', expect.anything());
  });

  it('words privacy as a benefit', async () => {
    await render(<WelcomeScreen />);
    await toPrivacy();

    expect(bar(4)).toBeTruthy();
    expect(screen.getByText('Private by default')).toBeTruthy();
  });

  describe('reminders', () => {
    it('asks when, with two hours chosen to start', async () => {
      await render(<WelcomeScreen />);
      await toReminders();

      expect(bar(5)).toBeTruthy();
      expect(
        screen.getByRole('radio', { name: '2 hours after I eat' }).props.accessibilityState,
      ).toMatchObject({
        checked: true,
      });
      expect(screen.getByText(/stays on your phone/)).toBeTruthy();
      // Nothing is asked of the phone, or saved, until they continue.
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalledWith('reminderAsked', expect.anything());
    });

    it('asks the phone next, then saves the chosen time once it allows it', async () => {
      // Hold the phone's answer so the screen shown while its prompt is up can be seen.
      let answer: (value: { granted: boolean }) => void = () => {};
      (Notifications.getPermissionsAsync as jest.Mock).mockReturnValueOnce(
        new Promise((resolve) => {
          answer = resolve;
        }),
      );
      await render(<WelcomeScreen />);
      await toReminders();
      await pick('radio', '3 hours after I eat');
      await press('Continue');

      expect(header('Let Bellie check in after meals')).toBeTruthy();
      expect(bar(5)).toBeTruthy();
      expect(mockUpdate).not.toHaveBeenCalledWith('reminderAsked', expect.anything());
      await act(async () => answer({ granted: true }));

      expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith('reminderAsked', true);
      expect(mockUpdate).toHaveBeenCalledWith('checkInReminderMinutes', 180);
      expect(screen.getByText(READY)).toBeTruthy();
    });

    it('marks it asked but leaves it off when the phone says no', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
      await render(<WelcomeScreen />);
      await toReminders();
      await press('Continue');
      await act(async () => {});

      expect(mockUpdate).toHaveBeenCalledWith('reminderAsked', true);
      expect(mockUpdate).not.toHaveBeenCalledWith('checkInReminderMinutes', expect.anything());
      expect(screen.getByText(READY)).toBeTruthy();
    });

    it('Back from Ready returns to the timing question after a time was chosen, not to the phone prompt', async () => {
      await render(<WelcomeScreen />);
      await toReminders();
      await pick('radio', '3 hours after I eat');
      await press('Continue');
      await act(async () => {});
      expect(screen.getByText(READY)).toBeTruthy();

      await press('Back');
      expect(header('When should Bellie check in?')).toBeTruthy();
      expect(
        screen.getByRole('radio', { name: '3 hours after I eat' }).props.accessibilityState,
      ).toMatchObject({
        checked: true,
      });
      // Asked once on the way in, not again on the way back.
      expect(Notifications.getPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it('"No reminders" skips the phone prompt, and Back from Ready returns to the question', async () => {
      await render(<WelcomeScreen />);
      await toReminders();
      await pick('radio', 'No reminders');
      await press('Continue');

      expect(mockUpdate).toHaveBeenCalledWith('reminderAsked', true);
      expect(mockUpdate).toHaveBeenCalledWith('checkInReminderMinutes', null);
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
      expect(screen.getByText(READY)).toBeTruthy();

      await press('Back');
      expect(header('When should Bellie check in?')).toBeTruthy();
      expect(screen.getByRole('radio', { name: 'No reminders' }).props.accessibilityState).toMatchObject({
        checked: true,
      });
    });
  });

  describe('ready', () => {
    async function toReady() {
      await render(<WelcomeScreen />);
      await toReminders();
      await pick('radio', 'No reminders');
      await press('Continue');
    }

    it('celebrates with no bar, and says where bedtime and medications are set', async () => {
      mockSettings = { bedtime: '21:00' };
      await toReady();

      expect(screen.getByText(READY)).toBeTruthy();
      expect(screen.queryByRole('progressbar')).toBeNull();
      expect(
        screen.getByText(
          'Bedtime is set to 9:00 PM for now. Change it in Settings, and add medications in Profile.',
        ),
      ).toBeTruthy();
      expect(mockUpdate).not.toHaveBeenCalledWith('onboardingDone', true);
    });

    it('"Log my first meal" finishes setup and opens the food page', async () => {
      await toReady();
      await press('Log my first meal');
      await act(async () => {});

      expect(mockUpdate).toHaveBeenCalledWith('onboardingDone', true);
      expect(mockSignIn).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/');
      expect(mockPush).toHaveBeenCalledWith('/log/food');
    });

    it('"Look around" finishes setup and stays on Today', async () => {
      await toReady();
      await press('Look around');
      await act(async () => {});

      expect(mockUpdate).toHaveBeenCalledWith('onboardingDone', true);
      expect(mockReplace).toHaveBeenCalledWith('/');
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
