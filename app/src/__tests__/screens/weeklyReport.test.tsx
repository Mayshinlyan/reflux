import { render, screen, waitFor } from '@testing-library/react-native';

import WeeklyReportScreen from '@/app/weekly-report';
import { createTestDb } from '@/db/__tests__/testDb';
import { createFoodLog } from '@/db/repositories/food';
import { createSymptomLog } from '@/db/repositories/symptoms';
import type { AppDb } from '@/db/types';
import { addDays, localDayKey } from '@/lib/localDay';
import { periodOf } from '@/lib/range';
import { currentTimeZone } from '@/lib/time';
import { lastFullWeek } from '@/lib/weeklyReport';
import { fetchInsight } from '@/services/relayClient';
import type { Insight } from '@/types/insight';

let mockDb: AppDb;
let closeDb: () => void;
let mockParams: { week?: string } = {};
let mockSeen = '';
let mockSummaries = true;
const mockUpdate = jest.fn();

jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => ({
    settings: { reportSeenWeek: mockSeen, summariesEnabled: mockSummaries },
    update: mockUpdate,
  }),
}));
jest.mock('@/services/relayClient', () => ({ fetchInsight: jest.fn() }));
// Sentry's SDK starts a cleanup timer on import; not needed here.
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
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
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, [effect]);
  },
}));

const todayKey = () => localDayKey(new Date().toISOString(), currentTimeZone());
const week = () => lastFullWeek(todayKey());
/** A local time on a day of the week being reported, so it lands on that day whatever the machine's zone. */
const at = (dayOffset: number, time: string) =>
  new Date(`${addDays(week().startKey, dayOffset)}T${time}`).toISOString();

const meal = (name: string, loggedAt: string) =>
  createFoodLog(mockDb, {
    loggedAt,
    entryType: 'diary',
    source: 'text',
    inputText: name,
    analysis: {
      isFood: true,
      mealName: name,
      items: [],
      overall: { verdict: 'ok', confidence: 'medium', reasoning: 'Because.' },
    },
    meta: { model: 'm', promptVersion: 'p', rulesetVersion: 'r' },
  });

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockParams = {};
  mockSeen = '';
  mockSummaries = true;
  mockUpdate.mockClear();
  // Bellie's summary is still on its way unless a test says otherwise.
  jest
    .mocked(fetchInsight)
    .mockReset()
    .mockReturnValue(new Promise<Insight>(() => {}));
});
afterEach(() => closeDb());

describe('Your week with Bellie', () => {
  it('says how many more meals it needs when there is not enough yet', async () => {
    meal('Toast', at(1, '08:00:00'));
    await render(<WeeklyReportScreen />);

    expect(screen.getByRole('header', { name: 'Your week with Bellie' })).toBeTruthy();
    expect(await screen.findByText('Not enough yet')).toBeTruthy();
    expect(screen.getByText('4 more meals with a check-in')).toBeTruthy();
    expect(screen.queryByText('Worth watching')).toBeNull();
  });

  it('lists the foods symptoms followed and the foods that sat well, and when it shows up', async () => {
    for (const day of [1, 2]) {
      meal('Spicy tacos', at(day, '18:30:00'));
      createSymptomLog(mockDb, { items: [{ key: 'heartburn' }], loggedAt: at(day, '20:00:00') });
      meal('Oatmeal', at(day, '08:00:00'));
    }
    meal('Toast', at(3, '08:00:00'));
    await render(<WeeklyReportScreen />);

    expect(await screen.findByText('Worth watching')).toBeTruthy();
    expect(screen.getByText('Spicy tacos')).toBeTruthy();
    expect(screen.getByText('2 of 2')).toBeTruthy();
    expect(screen.getByText('Sat well')).toBeTruthy();
    expect(screen.getByText('Oatmeal')).toBeTruthy();
    expect(screen.getByText('2 times')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'When it shows up' })).toBeTruthy();
    expect(screen.getByText('Mostly in the evening, after 6pm.')).toBeTruthy();
    expect(screen.getByText('Ideas, not medical advice.')).toBeTruthy();
  });

  it('opens the week it was asked for, not the newest one', async () => {
    const older = addDays(week().startKey, -7);
    mockParams = { week: older };
    createSymptomLog(mockDb, {
      items: [{ key: 'heartburn' }],
      loggedAt: new Date(`${addDays(older, 2)}T20:00:00`).toISOString(),
    });
    await render(<WeeklyReportScreen />);

    expect(await screen.findByText('Mostly in the evening, after 6pm.')).toBeTruthy();
  });

  it('says nothing stands out when there are enough meals but no pattern', async () => {
    for (let i = 0; i < 5; i += 1) meal(`Meal ${i}`, at(1, `0${i + 1}:00:00`));
    await render(<WeeklyReportScreen />);

    expect(await screen.findByText('Nothing stands out yet')).toBeTruthy();
    expect(screen.getByText('Keep logging')).toBeTruthy();
  });

  it('marks the week as seen once it has something to show, so Today stops offering it', async () => {
    createSymptomLog(mockDb, { items: [{ key: 'heartburn' }], loggedAt: at(2, '20:00:00') });
    await render(<WeeklyReportScreen />);

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('reportSeenWeek', week().startKey));
  });

  it('leaves a week that has not ended alone, so its own report is still offered when it does', async () => {
    const current = periodOf('week', todayKey()).startKey;
    mockParams = { week: current };
    createSymptomLog(mockDb, {
      items: [{ key: 'heartburn' }],
      loggedAt: new Date(`${current}T01:00:00`).toISOString(),
    });
    await render(<WeeklyReportScreen />);
    await screen.findByText('Mostly at night.');

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('does not mark an empty week as seen', async () => {
    await render(<WeeklyReportScreen />);
    await screen.findByText('Not enough yet');

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("adds Bellie's one thing to try when the week's summary has a tip", async () => {
    createSymptomLog(mockDb, { items: [{ key: 'heartburn' }], loggedAt: at(2, '20:00:00') });
    jest.mocked(fetchInsight).mockResolvedValue({
      tone: 'nudge',
      bellieLine: 'Easy on the spice.',
      summary: 'Heartburn came up in the evenings.',
      tips: ['Finish dinner 3 hours before bed.'],
    });
    await render(<WeeklyReportScreen />);

    expect(await screen.findByRole('header', { name: 'One thing to try' })).toBeTruthy();
    expect(screen.getByText('Finish dinner 3 hours before bed.')).toBeTruthy();
  });
});
