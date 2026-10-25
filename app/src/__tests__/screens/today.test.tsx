import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { Alert, ScrollView } from 'react-native';

import TodayScreen from '@/app/(tabs)/index';
import { createTestDb } from '@/db/__tests__/testDb';
import { createFoodLog, listDiaryFoodLogs } from '@/db/repositories/food';
import { createMedication, logMedication } from '@/db/repositories/medications';
import type { AppDb } from '@/db/types';
import { fetchInsight } from '@/services/relayClient';
import type { AppVerdict } from '@/types/analysis';
import type { Insight } from '@/types/insight';

let mockDb: AppDb;
let closeDb: () => void;
let mockOnboardingDone = true;
let mockUserName = '';
let mockReduceMotion = true;
let mockReminderAsked = true;
let mockReminderMinutes: number | null = null;
let mockNudged = true;
const mockUpdate = jest.fn();
const mockToast = jest.fn();
const mockPush = jest.fn();
const mockRedirect = jest.fn();

jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => ({
    settings: {
      onboardingDone: mockOnboardingDone,
      userName: mockUserName,
      bedtime: '22:30',
      lateMealWindowMinutes: 180,
      reminderAsked: mockReminderAsked,
      checkInReminderMinutes: mockReminderMinutes,
      insightNudged: mockNudged,
      summariesEnabled: true,
    },
    update: mockUpdate,
  }),
}));
jest.mock('@/services/relayClient', () => ({ fetchInsight: jest.fn() }));
jest.mock('@/components/Toast', () => ({ useToast: () => mockToast }));
// Reanimated's native runtime can't load in Jest; use its mocks (which lack useReducedMotion).
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => mockReduceMotion,
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Warning: 'warning' },
}));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  router: { push: (href: unknown) => mockPush(href) },
  Redirect: (props: { href: string }) => {
    mockRedirect(props.href);
    return null;
  },
  useFocusEffect: (effect: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, [effect]);
  },
}));

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockOnboardingDone = true;
  mockUserName = '';
  mockReduceMotion = true;
  mockReminderAsked = true;
  mockReminderMinutes = null;
  mockNudged = true;
  // Bellie's summary is still on its way unless a test says otherwise.
  jest
    .mocked(fetchInsight)
    .mockReset()
    .mockReturnValue(new Promise<Insight>(() => {}));
  mockUpdate.mockClear();
  mockToast.mockClear();
  jest.mocked(Notifications.requestPermissionsAsync).mockClear();
  mockPush.mockClear();
  mockRedirect.mockClear();
});
afterEach(() => closeDb());

const seedMeal = (mealName: string, verdict: AppVerdict, loggedAt: string) =>
  createFoodLog(mockDb, {
    loggedAt,
    entryType: 'diary',
    source: 'text',
    inputText: mealName,
    analysis: {
      isFood: true,
      mealName,
      items: [],
      overall: { verdict: verdict === 'good' ? 'ok' : verdict, confidence: 'medium', reasoning: 'Because.' },
    },
    meta: { model: 'm', promptVersion: 'p', rulesetVersion: 'r' },
  });

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const ALL_TIME = { from: '2000-01-01T00:00:00.000Z', to: '2100-01-01T00:00:00.000Z' };

/** Presses the Undo on the most recent toast, as a tap on it would. */
const pressUndo = () => mockToast.mock.calls.at(-1)?.[1].action.onPress();

describe('Today: an empty day', () => {
  it('greets, shows the week with today marked, and invites a first meal', async () => {
    await render(<TodayScreen />);

    expect(screen.getByRole('header', { name: /^Good (morning|afternoon|evening)$/ })).toBeTruthy();
    expect(
      screen.getAllByLabelText(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday) \d+/),
    ).toHaveLength(6);
    expect(screen.getAllByLabelText(/^Today, /)).toHaveLength(1);
    expect(screen.getByText('Tap me to log')).toBeTruthy();
    expect(screen.getByLabelText('Belly feels happy')).toBeTruthy();
    expect(screen.queryByText('Today')).toBeNull();
  });

  it('adds the name to the greeting once one is set', async () => {
    mockUserName = 'May';
    await render(<TodayScreen />);

    expect(screen.getByRole('header', { name: /^Good (morning|afternoon|evening), May$/ })).toBeTruthy();
  });

  it('has no round profile button beside the greeting, since Profile is a tab', async () => {
    await render(<TodayScreen />);

    expect(screen.queryByRole('button', { name: 'Profile' })).toBeNull();
  });

  it('opens the Food screen at once when the belly is tapped and Reduce Motion is on', async () => {
    await render(<TodayScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/log/food');
  });

  describe('with motion on', () => {
    beforeEach(() => {
      mockReduceMotion = false;
    });

    it('opens the Food screen on the tap itself, without waiting for the jiggle', async () => {
      await render(<TodayScreen />);

      await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/log/food');
    });

    it('ignores a second tap while the Food screen is opening', async () => {
      await render(<TodayScreen />);

      await fireEvent.press(screen.getByRole('button', { name: 'Log' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

      expect(mockPush).toHaveBeenCalledTimes(1);
    });
  });

  it('opens the Log page for the day tapped in the week strip', async () => {
    await render(<TodayScreen />);

    await fireEvent.press(screen.getByLabelText(/^Today, /));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/log',
      params: { date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
    });
  });

  describe('tapping an earlier day', () => {
    const earlierDay = () => {
      const now = new Date();
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      return `${day.getDate()}`;
    };

    it('opens the Log page for that day on the tap, and ignores a second tap', async () => {
      // The first day of a week has no earlier day this week, so there is nothing to tap.
      if (new Date().getDay() === 0) return;
      await render(<TodayScreen />);

      await fireEvent.press(screen.getByLabelText(new RegExp(`^\\w+ ${earlierDay()}`)));
      await fireEvent.press(screen.getByLabelText(new RegExp(`^\\w+ ${earlierDay()}`)));

      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/log',
        params: { date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
      });
    });
  });

  it('has no pet, coins or old Log menu', async () => {
    await render(<TodayScreen />);

    expect(screen.queryByLabelText(/coins/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Scan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
  });

  it('sends a first-time user to Welcome', async () => {
    mockOnboardingDone = false;
    await render(<TodayScreen />);

    expect(mockRedirect).toHaveBeenCalledWith('/welcome');
  });
});

describe("Today: Bellie's words", () => {
  const dayInsight: Insight = {
    tone: 'nudge',
    bellieLine: 'Easy on the spice tonight?',
    summary: 'Spicy ramen at lunch. Chili keeps showing up.',
    tips: ['Have spicy food earlier in the day.'],
  };
  const weekInsight: Insight = {
    tone: 'cheer',
    bellieLine: 'A good week so far!',
    summary: 'Mostly good meals this week.',
    tips: [],
  };
  const answer = (request: { range: string }) =>
    Promise.resolve(request.range === 'day' ? dayInsight : weekInsight);

  it('asks for nothing and says "Tap me to log" with no cards on a day with nothing logged', async () => {
    await render(<TodayScreen />);

    expect(screen.getByText('Tap me to log')).toBeTruthy();
    expect(screen.queryByText('Today so far')).toBeNull();
    expect(fetchInsight).not.toHaveBeenCalled();
  });

  it('shows the words made on the phone at once, with a card for today and one for the week', async () => {
    seedMeal('Spicy ramen', 'caution', minutesAgo(5));
    await render(<TodayScreen />);

    expect(screen.getByText('Go easy tonight?')).toBeTruthy();
    expect(screen.getByText('Today so far')).toBeTruthy();
    expect(screen.getByText('1 meal today: 0 good, 1 to watch.')).toBeTruthy();
    expect(screen.getByText('Tips')).toBeTruthy();
    expect(screen.getByText('This week')).toBeTruthy();
  });

  it("puts Bellie's own line in the bubble and her summaries on the cards once they arrive", async () => {
    jest.mocked(fetchInsight).mockImplementation(answer);
    seedMeal('Spicy ramen', 'caution', minutesAgo(5));
    await render(<TodayScreen />);

    expect(await screen.findByText('Easy on the spice tonight?')).toBeTruthy();
    expect(screen.getByText('Spicy ramen at lunch. Chili keeps showing up.')).toBeTruthy();
    expect(screen.getByText('Have spicy food earlier in the day.')).toBeTruthy();
    expect(screen.getByText('Mostly good meals this week.')).toBeTruthy();
  });

  it('sends only the meal name, verdict and time, for the day and for the week', async () => {
    seedMeal('Spicy ramen', 'caution', minutesAgo(5));
    await render(<TodayScreen />);

    const sent = jest.mocked(fetchInsight).mock.calls.map(([request]) => request);
    expect(sent.map((request) => request.range).sort()).toEqual(['day', 'week']);
    for (const request of sent) {
      expect(request.meals).toEqual([{ name: 'Spicy ramen', verdict: 'caution', when: expect.any(String) }]);
      expect(Object.keys(request).sort()).toEqual(['meals', 'range', 'symptoms', 'tags']);
    }
  });

  it('tells Bellie from the rest of the screen: tapping her opens the Food screen', async () => {
    jest.mocked(fetchInsight).mockImplementation(answer);
    seedMeal('Spicy ramen', 'caution', minutesAgo(5));
    await render(<TodayScreen />);
    await screen.findByText('Easy on the spice tonight?');

    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    expect(mockPush).toHaveBeenCalledWith('/log/food');
  });

  describe('the sideways nudge', () => {
    beforeEach(() => {
      mockReduceMotion = false;
      mockNudged = false;
      jest.useFakeTimers();
    });
    afterEach(() => jest.useRealTimers());

    it('plays once, after a moment, when there are cards to swipe, and is remembered', async () => {
      seedMeal('Spicy ramen', 'caution', minutesAgo(5));
      await render(<TodayScreen />);
      expect(mockUpdate).not.toHaveBeenCalledWith('insightNudged', true);

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(mockUpdate).toHaveBeenCalledWith('insightNudged', true);
    });

    it('never moves the cards under a finger that is already on them', async () => {
      // jest-expo's ScrollView already mocks scrollTo, so spyOn hands back that mock with the last test's calls on it.
      const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
      scrollTo.mockClear();
      seedMeal('Spicy ramen', 'caution', minutesAgo(5));
      await render(<TodayScreen />);

      await fireEvent(screen.getByText('Today so far'), 'touchStart');
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      expect(scrollTo).not.toHaveBeenCalled();
      // They have found the swipe, so it counts as seen.
      expect(mockUpdate).toHaveBeenCalledWith('insightNudged', true);
      scrollTo.mockRestore();
    });

    it('does not play again once it has been seen, or with Reduce Motion on', async () => {
      seedMeal('Spicy ramen', 'caution', minutesAgo(5));
      mockNudged = true;
      const seen = await render(<TodayScreen />);
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(mockUpdate).not.toHaveBeenCalledWith('insightNudged', true);
      await seen.unmount();

      mockNudged = false;
      mockReduceMotion = true;
      await render(<TodayScreen />);
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(mockUpdate).not.toHaveBeenCalledWith('insightNudged', true);
    });
  });
});

describe('Today: after logging', () => {
  it('lists every entry for today, newest first, with Bellie saying something instead of a count', async () => {
    seedMeal('Oatmeal with banana', 'good', minutesAgo(3));
    seedMeal('Grilled salmon', 'ok', minutesAgo(2));
    const medication = createMedication(mockDb, { name: 'Omeprazole', type: 'ppi' });
    logMedication(mockDb, medication, { doseText: '20mg', takenAt: minutesAgo(1) });
    await render(<TodayScreen />);

    // Words made on the phone while Bellie's summary is on its way.
    expect(screen.getByText('A calm day so far!')).toBeTruthy();
    expect(screen.queryByText('logged today')).toBeNull();
    expect(screen.getByText('3 entries')).toBeTruthy();
    expect(screen.getByText('Taken')).toBeTruthy();
    expect(screen.queryByText('Tap me to log')).toBeNull();
    const rows = screen.getAllByRole('button').map((button) => button.props.accessibilityLabel as string);
    expect(
      rows.filter((label) => /^(Meal|Medication):/.test(label ?? '')).map((label) => label.split(',')[0]),
    ).toEqual(['Medication: Omeprazole 20mg', 'Meal: Grilled salmon', 'Meal: Oatmeal with banana']);
  });

  it('says "1 entry" for a single meal', async () => {
    seedMeal('Toast', 'good', minutesAgo(1));
    await render(<TodayScreen />);

    expect(screen.getByText('1 entry')).toBeTruthy();
  });

  it("marks today's dot on the week strip", async () => {
    seedMeal('Toast', 'good', minutesAgo(1));
    await render(<TodayScreen />);

    expect(screen.getAllByLabelText(/^Today, .*, has entries$/)).toHaveLength(1);
  });

  it("gives the belly the mood of the latest meal's verdict", async () => {
    seedMeal('Toast', 'good', minutesAgo(5));
    seedMeal('Spicy ramen', 'trigger', minutesAgo(1));
    await render(<TodayScreen />);

    expect(screen.getByLabelText('Belly feels unwell')).toBeTruthy();
  });

  it('shows each meal with its verdict', async () => {
    seedMeal('Spicy ramen', 'caution', minutesAgo(1));
    await render(<TodayScreen />);

    expect(screen.getByLabelText('Caution')).toBeTruthy();
  });

  it("opens an entry's own page, not History, when it is tapped", async () => {
    const mealId = seedMeal('Spicy ramen', 'caution', minutesAgo(1));
    const medId = createMedication(mockDb, { name: 'Omeprazole', type: 'ppi', defaultDose: '20 mg' });
    const doseId = logMedication(mockDb, medId, { takenAt: minutesAgo(2) });
    await render(<TodayScreen />);

    await fireEvent.press(screen.getByRole('button', { name: /^Meal: Spicy ramen/ }));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/entry',
      params: { kind: 'food', id: String(mealId) },
    });
    await fireEvent.press(screen.getByRole('button', { name: /^Medication: Omeprazole/ }));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/entry',
      params: { kind: 'medication', id: String(doseId) },
    });
  });
});

describe('Today: swipe to delete an entry', () => {
  it('removes the meal at once with no alert, and offers Undo, as History does', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    seedMeal('Spicy ramen', 'caution', minutesAgo(1));
    await render(<TodayScreen />);
    expect(screen.getByText('1 entry')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete Spicy ramen' }));

    expect(alert).not.toHaveBeenCalled();
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(screen.queryByText('Spicy ramen')).toBeNull();
    expect(screen.queryByText('1 entry')).toBeNull();
    expect(mockToast).toHaveBeenLastCalledWith('Entry deleted', {
      action: { label: 'Undo', onPress: expect.any(Function) },
    });
  });

  it('puts the meal back when Undo is pressed', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    seedMeal('Spicy ramen', 'caution', minutesAgo(1));
    await render(<TodayScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete Spicy ramen' }));

    await act(async () => pressUndo());

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(1);
    expect(screen.getByText('Spicy ramen')).toBeTruthy();
    expect(screen.getByText('1 entry')).toBeTruthy();
  });
});

describe('Today: the one-time reminder offer', () => {
  const seedMeals = (n: number) => {
    for (let i = 0; i < n; i++) seedMeal(`Meal ${i}`, 'good', `2026-10-1${i}T08:00:00.000Z`);
  };
  const offer = () => screen.queryByRole('header', { name: 'Want a gentle nudge?' });

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('appears once there are three meals and they have not been asked', async () => {
    mockReminderAsked = false;
    seedMeals(3);
    await render(<TodayScreen />);

    expect(offer()).toBeTruthy();
  });

  it('waits until the third meal', async () => {
    mockReminderAsked = false;
    seedMeals(2);
    await render(<TodayScreen />);

    expect(offer()).toBeNull();
  });

  it('stays away once they have been asked', async () => {
    seedMeals(3);
    await render(<TodayScreen />);
    expect(offer()).toBeNull();
  });

  it('stays away when reminders are already on', async () => {
    mockReminderAsked = false;
    mockReminderMinutes = 120;
    seedMeals(3);
    await render(<TodayScreen />);

    expect(offer()).toBeNull();
  });

  it('"Not now" counts as asked and leaves reminders off', async () => {
    mockReminderAsked = false;
    seedMeals(3);
    await render(<TodayScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockUpdate).toHaveBeenCalledWith('reminderAsked', true);
    expect(mockUpdate).not.toHaveBeenCalledWith('checkInReminderMinutes', expect.anything());
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('"Yes please" turns it on at two hours once the phone allows it', async () => {
    mockReminderAsked = false;
    seedMeals(3);
    await render(<TodayScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Yes please' }));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockUpdate).toHaveBeenCalledWith('reminderAsked', true);
    expect(mockUpdate).toHaveBeenCalledWith('checkInReminderMinutes', 120);
    expect(mockToast).toHaveBeenCalledWith('Reminders are on');
  });

  it('"Yes please" still counts as asked, with reminders left off, when the phone says no', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    mockReminderAsked = false;
    seedMeals(3);
    await render(<TodayScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Yes please' }));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockUpdate).toHaveBeenCalledWith('reminderAsked', true);
    expect(mockUpdate).not.toHaveBeenCalledWith('checkInReminderMinutes', expect.anything());
    expect(mockToast).not.toHaveBeenCalled();
  });
});
