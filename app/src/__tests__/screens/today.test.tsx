import { act, fireEvent, render, screen } from '@testing-library/react-native';

import TodayScreen from '@/app/(tabs)/index';
import { createTestDb } from '@/db/__tests__/testDb';
import { createFoodLog } from '@/db/repositories/food';
import { createMedication, logMedication } from '@/db/repositories/medications';
import type { AppDb } from '@/db/types';
import type { AppVerdict } from '@/types/analysis';

let mockDb: AppDb;
let closeDb: () => void;
let mockOnboardingDone = true;
let mockReduceMotion = true;
const mockPush = jest.fn();
const mockRedirect = jest.fn();

jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => ({
    settings: { onboardingDone: mockOnboardingDone, bedtime: '22:30', lateMealWindowMinutes: 180 },
  }),
}));
// Reanimated's native runtime can't load in Jest; use its mocks (which lack useReducedMotion).
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => mockReduceMotion,
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
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
  mockReduceMotion = true;
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

  it('opens the Log page at once when the belly is tapped and Reduce Motion is on', async () => {
    await render(<TodayScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/log');
  });

  describe('with motion on', () => {
    beforeEach(() => {
      mockReduceMotion = false;
      jest.useFakeTimers();
    });
    afterEach(() => jest.useRealTimers());

    it('lets the belly jiggle first, then opens the Log page', async () => {
      await render(<TodayScreen />);

      await fireEvent.press(screen.getByRole('button', { name: 'Log' }));
      expect(mockPush).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(400);
      });
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/log');
    });

    it('ignores a second tap while the jiggle is playing', async () => {
      await render(<TodayScreen />);

      await fireEvent.press(screen.getByRole('button', { name: 'Log' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Log' }));
      await act(async () => {
        jest.advanceTimersByTime(400);
      });

      expect(mockPush).toHaveBeenCalledTimes(1);
    });

    it('does not open Log if the screen goes away mid-jiggle', async () => {
      await render(<TodayScreen />);

      await fireEvent.press(screen.getByRole('button', { name: 'Log' }));
      await screen.unmount();
      jest.advanceTimersByTime(400);

      expect(mockPush).not.toHaveBeenCalled();
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

describe('Today: after logging', () => {
  it('counts meals on the ring and lists every entry for today, newest first', async () => {
    seedMeal('Oatmeal with banana', 'good', minutesAgo(3));
    seedMeal('Grilled salmon', 'ok', minutesAgo(2));
    const medication = createMedication(mockDb, { name: 'Omeprazole', type: 'ppi' });
    logMedication(mockDb, medication, { doseText: '20mg', takenAt: minutesAgo(1) });
    await render(<TodayScreen />);

    expect(screen.getByText('2 meals')).toBeTruthy();
    expect(screen.getByText('logged today')).toBeTruthy();
    expect(screen.getByText('3 entries')).toBeTruthy();
    expect(screen.getByText('Taken')).toBeTruthy();
    expect(screen.queryByText('Tap me to log')).toBeNull();
    const rows = screen.getAllByRole('button').map((button) => button.props.accessibilityLabel as string);
    expect(
      rows.filter((label) => /^(Meal|Medication):/.test(label ?? '')).map((label) => label.split(',')[0]),
    ).toEqual(['Medication: Omeprazole 20mg', 'Meal: Grilled salmon', 'Meal: Oatmeal with banana']);
  });

  it('says "1 meal" and "1 entry" for a single meal', async () => {
    seedMeal('Toast', 'good', minutesAgo(1));
    await render(<TodayScreen />);

    expect(screen.getByText('1 meal')).toBeTruthy();
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
});
