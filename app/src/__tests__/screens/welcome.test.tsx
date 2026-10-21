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
const bar = (step: number) => screen.getByRole('progressbar', { name: `Step ${step} of 10` });

const CONDITION_ACID = 'Burning in my chest, Acid reflux or GERD';
const CONDITION_LPR = 'Hoarse voice, throat clearing, Silent reflux (LPR)';
const CONDITION_UNSURE = "I'm not sure yet, We'll learn it together";

/** Walks from the greeting to the first setup question. */
async function toCondition() {
  await press('Get started');
  await press('Continue'); // Meet Bellie
  await press('Continue'); // How it works
  await press('Continue'); // Example insight
}

/** Answers condition and skips symptoms, bedtime and medications, landing on Privacy. */
async function toPrivacy() {
  await toCondition();
  await pick('checkbox', CONDITION_ACID);
  await press('Continue');
  await press('Skip for now'); // symptoms
  await press('Continue'); // bedtime
  await press('Skip for now'); // medications
  expect(header('Everything stays on your phone.')).toBeTruthy();
}

/** Continues from Privacy to the reminder timing question. */
async function toReminders() {
  await toPrivacy();
  await press('Continue');
  expect(header('When should Bellie check in?')).toBeTruthy();
}

describe('Welcome', () => {
  it('starts on the greeting with no back button and no progress bar', async () => {
    await render(<WelcomeScreen />);

    expect(header("Let's see how your belly feels.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('introduces Bellie on the second step, and Back returns to the greeting', async () => {
    await render(<WelcomeScreen />);
    await press('Get started');

    expect(screen.getByText("Hi there! I'm Bellie!")).toBeTruthy();
    expect(bar(1)).toBeTruthy();

    await press('Back');
    expect(header("Let's see how your belly feels.")).toBeTruthy();
  });

  it('shows how logging works and an example pattern, both marked as examples', async () => {
    await render(<WelcomeScreen />);
    await press('Get started');
    await press('Continue');

    expect(header('Log a meal in seconds.')).toBeTruthy();
    expect(bar(2)).toBeTruthy();
    expect(screen.getByLabelText(/Example: a photo of your meal/)).toBeTruthy();

    await press('Continue');
    expect(header('Patterns show up as you log.')).toBeTruthy();
    expect(bar(3)).toBeTruthy();
    expect(screen.getByLabelText(/Example: Spicy meals/)).toBeTruthy();
  });

  describe('condition step', () => {
    it('starts with nothing picked and waits for a choice', async () => {
      await render(<WelcomeScreen />);
      await toCondition();

      expect(header("What's bothering you?")).toBeTruthy();
      expect(bar(4)).toBeTruthy();
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
      expect(bar(5)).toBeTruthy();
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
      expect(header('When do you usually go to bed?')).toBeTruthy();
    });

    it('saves nothing when they skip', async () => {
      await render(<WelcomeScreen />);
      await toCondition();
      await pick('checkbox', CONDITION_ACID);
      await press('Continue');
      await press('Skip for now');

      expect(mockUpdate).not.toHaveBeenCalledWith('usualSymptoms', expect.anything());
      expect(header('When do you usually go to bed?')).toBeTruthy();
    });
  });

  it('saves the bedtime and the late-meal window', async () => {
    await render(<WelcomeScreen />);
    await toCondition();
    await pick('checkbox', CONDITION_ACID);
    await press('Continue');
    await press('Skip for now');

    expect(screen.getByRole('button', { name: 'Bedtime, 10:30 PM' })).toBeTruthy();
    expect(bar(6)).toBeTruthy();
    await press('Bedtime, 10:30 PM');
    await pick('radio', '9:00 PM');
    expect(screen.getByRole('button', { name: 'Bedtime, 9:00 PM' })).toBeTruthy();
    await press('Late meal window, 3 hours before bed');
    await pick('radio', '2 hours before bed');
    await press('Continue');

    expect(mockUpdate).toHaveBeenCalledWith('bedtime', '21:00');
    expect(mockUpdate).toHaveBeenCalledWith('lateMealWindowMinutes', 120);
  });

  describe('medications step', () => {
    async function toMedications() {
      await render(<WelcomeScreen />);
      await toCondition();
      await pick('checkbox', CONDITION_ACID);
      await press('Continue');
      await press('Skip for now');
      await press('Continue');
      expect(header('Do you take any medication?')).toBeTruthy();
    }

    it('offers "Skip for now" while the list is empty and saves nothing', async () => {
      await toMedications();

      expect(bar(7)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
      await press('Skip for now');

      expect(listMedications(mockDb)).toEqual([]);
      expect(header('Everything stays on your phone.')).toBeTruthy();
    });

    it('adds a common medication with a dose, then offers "Continue"', async () => {
      await toMedications();
      await press('Add a medication');
      await pick('button', 'Omeprazole (Prilosec)');

      expect(screen.getByText('Type: PPI')).toBeTruthy();
      await pick('radio', '20mg');
      await press('Add medication');

      expect(listMedications(mockDb).map((med) => [med.name, med.defaultDose, med.type])).toEqual([
        ['Omeprazole (Prilosec)', '20mg', 'ppi'],
      ]);
      expect(screen.getByText('Omeprazole (Prilosec) 20mg')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Skip for now' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Add another' })).toBeTruthy();
      await press('Continue');
      expect(header('Everything stays on your phone.')).toBeTruthy();
    });

    it('adds one that is not listed from a name, a type and an optional dose', async () => {
      await toMedications();
      await press('Add a medication');
      await press('Not listed? Enter your own');

      expect(screen.getByRole('button', { name: 'Add medication' }).props.accessibilityState).toMatchObject({
        disabled: true,
      });
      await fireEvent.changeText(screen.getByLabelText('Name'), '  Zegerid ');
      await pick('radio', 'Antacid');
      await fireEvent.changeText(screen.getByLabelText('Dose'), '40mg');
      await press('Add medication');

      expect(listMedications(mockDb).map((med) => [med.name, med.defaultDose, med.type])).toEqual([
        ['Zegerid', '40mg', 'antacid'],
      ]);
    });

    it('removes one by archiving it, and keeps the rest when they come back', async () => {
      await toMedications();
      await press('Add a medication');
      await pick('button', 'Tums');
      await press('Add medication');
      await press('Continue');
      await press('Back');

      // Coming back shows what was saved, without duplicating it.
      expect(screen.getByText('Tums')).toBeTruthy();
      expect(listMedications(mockDb)).toHaveLength(1);

      await press('Remove Tums');
      expect(listMedications(mockDb)).toEqual([]);
      expect(screen.getByRole('button', { name: 'Skip for now' })).toBeTruthy();
    });
  });

  it('words privacy as a benefit', async () => {
    await render(<WelcomeScreen />);
    await toPrivacy();

    expect(bar(8)).toBeTruthy();
    expect(screen.getByText('Private by default')).toBeTruthy();
  });

  describe('reminders', () => {
    it('asks when, with two hours chosen to start', async () => {
      await render(<WelcomeScreen />);
      await toReminders();

      expect(bar(9)).toBeTruthy();
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
      expect(bar(9)).toBeTruthy();
      expect(mockUpdate).not.toHaveBeenCalledWith('reminderAsked', expect.anything());
      await act(async () => answer({ granted: true }));

      expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith('reminderAsked', true);
      expect(mockUpdate).toHaveBeenCalledWith('checkInReminderMinutes', 180);
      expect(header("Here's your plan.")).toBeTruthy();
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
      expect(header("Here's your plan.")).toBeTruthy();
    });

    it('Back from the recap returns to the timing question after a time was chosen, not to the phone prompt', async () => {
      await render(<WelcomeScreen />);
      await toReminders();
      await pick('radio', '3 hours after I eat');
      await press('Continue');
      await act(async () => {});
      expect(header("Here's your plan.")).toBeTruthy();

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

    it('"No reminders" skips the phone prompt, and Back from the recap returns to the question', async () => {
      await render(<WelcomeScreen />);
      await toReminders();
      await pick('radio', 'No reminders');
      await press('Continue');

      expect(mockUpdate).toHaveBeenCalledWith('reminderAsked', true);
      expect(mockUpdate).toHaveBeenCalledWith('checkInReminderMinutes', null);
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
      expect(header("Here's your plan.")).toBeTruthy();
      expect(screen.getByText('Off for now. You can turn them on in Settings.')).toBeTruthy();

      await press('Back');
      expect(header('When should Bellie check in?')).toBeTruthy();
      expect(screen.getByRole('radio', { name: 'No reminders' }).props.accessibilityState).toMatchObject({
        checked: true,
      });
    });
  });

  it('says back what they chose on the recap, then finishes on a celebration with no bar', async () => {
    await render(<WelcomeScreen />);
    await toReminders();
    // As if the earlier answers had been saved (the settings hook is mocked here).
    mockSettings = {
      usualSymptoms: ['heartburn', 'hoarseness'],
      bedtime: '21:00',
      checkInReminderMinutes: 120,
    };
    await press('Continue');
    await act(async () => {});

    expect(header("Here's your plan.")).toBeTruthy();
    expect(bar(10)).toBeTruthy();
    expect(screen.getByText('Heartburn and hoarse voice')).toBeTruthy();
    expect(screen.getByText('9:00 PM')).toBeTruthy();
    expect(screen.getByText('2 hours after meals')).toBeTruthy();
    await press('Looks good');

    expect(screen.getByText('Ready when you are!')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalledWith('onboardingDone', true);
  });

  describe('ready', () => {
    async function toReady() {
      mockSettings = {};
      await render(<WelcomeScreen />);
      await toReminders();
      await pick('radio', 'No reminders');
      await press('Continue');
      await press('Looks good');
    }

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
