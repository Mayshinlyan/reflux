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
const bar = (step: number) => screen.getByRole('progressbar', { name: `Step ${step} of 6` });

const HELLO = "Hi, I'm Bellie! Let's see how your tummy feels.";
const CONDITION_ACID = 'Burning in my chest, Acid reflux or GERD';
const CONDITION_LPR = 'Hoarse voice, throat clearing, Silent reflux (LPR)';
const CONDITION_UNSURE = "I'm not sure yet, We'll learn it together";

/** Setup is done: marked as onboarded and signed in quietly, with the first-meal invitation up and Today not yet open. */
function expectFinished() {
  expect(mockUpdate).toHaveBeenCalledWith('onboardingDone', true);
  expect(mockSignIn).toHaveBeenCalledTimes(1);
  expect(header("Let's log your first meal")).toBeTruthy();
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
}

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
  expect(header('Your data stays anonymous.')).toBeTruthy();
}

/** Continues from Privacy to the bedtime question. */
async function toBedtime() {
  await toPrivacy();
  await press('Continue');
  expect(header('When do you go to bed?')).toBeTruthy();
}

/** Continues from Bedtime to the reminder timing question. */
async function toReminders() {
  await toBedtime();
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

  it('says what you get for logging, with an example of the weekly list marked as an example', async () => {
    await render(<WelcomeScreen />);
    await press('Get started');

    expect(header('Find what upsets your body.')).toBeTruthy();
    expect(screen.getByText('Log for a week and Bellie makes your own list.')).toBeTruthy();
    expect(bar(1)).toBeTruthy();
    expect(screen.getByText('Example')).toBeTruthy();
    expect(screen.getByLabelText(/Example: Worth watching, Spicy chicken tacos/)).toBeTruthy();

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
      expect(header('Your data stays anonymous.')).toBeTruthy();
    });

    it('saves nothing when they skip', async () => {
      await render(<WelcomeScreen />);
      await toCondition();
      await pick('checkbox', CONDITION_ACID);
      await press('Continue');
      await press('Skip for now');

      expect(mockUpdate).not.toHaveBeenCalledWith('usualSymptoms', expect.anything());
      expect(header('Your data stays anonymous.')).toBeTruthy();
    });
  });

  it('words privacy around anonymity, in one line per point', async () => {
    await render(<WelcomeScreen />);
    await toPrivacy();

    expect(bar(4)).toBeTruthy();
    expect(screen.getByText('No sign-in')).toBeTruthy();
    expect(screen.getByText('Meal checks use AI')).toBeTruthy();
    expect(screen.queryByText('Private by default')).toBeNull();
  });

  describe('bedtime', () => {
    it('asks when, with the saved bedtime chosen to start, and no medications question', async () => {
      await render(<WelcomeScreen />);
      await toBedtime();

      expect(bar(5)).toBeTruthy();
      expect(screen.getByRole('radio', { name: '10:30 PM' }).props.accessibilityState).toMatchObject({
        checked: true,
      });
      expect(screen.queryByText('Do you take any medication?')).toBeNull();
    });

    it('saves a different time when they pick one', async () => {
      await render(<WelcomeScreen />);
      await toBedtime();
      await pick('radio', '11:30 PM');
      await press('Continue');

      expect(mockUpdate).toHaveBeenCalledWith('bedtime', '23:30');
      expect(header('When should Bellie check in?')).toBeTruthy();
    });

    it('writes nothing when they keep the default', async () => {
      await render(<WelcomeScreen />);
      await toBedtime();
      await press('Continue');

      expect(mockUpdate).not.toHaveBeenCalledWith('bedtime', expect.anything());
    });

    it('Back from reminders returns here', async () => {
      await render(<WelcomeScreen />);
      await toReminders();
      await press('Back');

      expect(header('When do you go to bed?')).toBeTruthy();
    });
  });

  describe('reminders', () => {
    it('asks when, with two hours chosen to start', async () => {
      await render(<WelcomeScreen />);
      await toReminders();

      expect(bar(6)).toBeTruthy();
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
      expect(bar(6)).toBeTruthy();
      expect(mockUpdate).not.toHaveBeenCalledWith('reminderAsked', expect.anything());
      await act(async () => answer({ granted: true }));

      expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith('reminderAsked', true);
      expect(mockUpdate).toHaveBeenCalledWith('checkInReminderMinutes', 180);
      expectFinished();
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
      expectFinished();
    });

    it('"No reminders" skips the phone prompt and finishes setup', async () => {
      await render(<WelcomeScreen />);
      await toReminders();
      await pick('radio', 'No reminders');
      await press('Continue');

      expect(mockUpdate).toHaveBeenCalledWith('reminderAsked', true);
      expect(mockUpdate).toHaveBeenCalledWith('checkInReminderMinutes', null);
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
      expectFinished();
    });
  });

  describe('first meal', () => {
    const toFirstMeal = async () => {
      await render(<WelcomeScreen />);
      await toReminders();
      await pick('radio', 'No reminders');
      await press('Continue');
    };

    it('invites a first meal: "Log a meal" opens Food over Today', async () => {
      await toFirstMeal();
      expect(screen.getByText('Anything you ate today. Bellie will tell you how it sits.')).toBeTruthy();

      await press('Log a meal');

      expect(mockReplace).toHaveBeenCalledWith('/');
      expect(mockPush).toHaveBeenCalledWith('/log/food');
    });

    it('"Skip for now" goes straight to Today', async () => {
      await toFirstMeal();
      await press('Skip for now');

      expect(mockReplace).toHaveBeenCalledWith('/');
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('goes back to the timing question, not the permission screen', async () => {
      await toFirstMeal();
      await press('Back');

      expect(header('When should Bellie check in?')).toBeTruthy();
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });
  });
});
