import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import LogFoodScreen from '@/app/log/food';
import { createTestDb } from '@/db/__tests__/testDb';
import { listDiaryFoodLogs } from '@/db/repositories/food';
import type { AppDb } from '@/db/types';
import { AppError, friendlyMessages } from '@/lib/errors';
import { analyzeFood } from '@/services/relayClient';

let mockDb: AppDb;
let closeDb: () => void;
const mockBack = jest.fn();
const mockToast = jest.fn();

jest.mock('@/db/DatabaseProvider', () => ({ useDb: () => mockDb }));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('@/components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('@/services/relayClient', () => ({ analyzeFood: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { back: () => mockBack(), canGoBack: () => true, replace: jest.fn() },
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));

const analyze = analyzeFood as jest.Mock;

const result = {
  isFood: true,
  mealName: 'Mint tea',
  items: [
    {
      name: 'Mint tea',
      ingredients: [{ name: 'Peppermint', matchedCategories: ['mint'] }],
      verdict: 'caution',
      reasoning: 'Peppermint relaxes the valve.',
      matchedTriggers: [{ category: 'mint', evidence: 'peppermint' }],
    },
  ],
  overall: { verdict: 'caution', confidence: 'high', reasoning: 'Mint is a common trigger.' },
  meta: { model: 'm', promptVersion: 'p', rulesetVersion: 'r' },
};

const ALL_TIME = { from: '2000-01-01T00:00:00.000Z', to: '2100-01-01T00:00:00.000Z' };
const type = async (value: string) => fireEvent.changeText(screen.getByLabelText('What did you eat?'), value);
const press = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockBack.mockClear();
  mockToast.mockClear();
  analyze.mockReset();
});

afterEach(() => closeDb());

describe('Log food screen (text)', () => {
  it('keeps "Check it" disabled until something is typed', async () => {
    await render(<LogFoodScreen />);
    expect(screen.getByRole('button', { name: 'Check it' })).toBeDisabled();
    await type('   ');
    expect(screen.getByRole('button', { name: 'Check it' })).toBeDisabled();
  });

  it('analyzes the trimmed text, shows the result, and saves it to the diary', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);

    await type('  mint tea ');
    await press('Check it');

    expect(await screen.findByText('Mint is a common trigger.')).toBeTruthy();
    expect(analyze).toHaveBeenCalledWith({ text: 'mint tea' }, expect.any(AbortSignal));

    await press('Save to diary');

    const logs = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      entryType: 'diary',
      source: 'text',
      inputText: 'mint tea',
      mealName: 'Mint tea',
      overallVerdict: 'caution',
      analysisMeta: result.meta,
    });
    expect(logs[0].analysis).not.toHaveProperty('meta');
    expect(mockToast).toHaveBeenCalledWith('Meal logged');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('saves the text that was analyzed, even if the field is edited while loading', async () => {
    let resolve!: (value: unknown) => void;
    analyze.mockReturnValue(new Promise((r) => (resolve = r)));
    await render(<LogFoodScreen />);

    await type('mint tea');
    await press('Check it');
    await type('pizza');
    await act(async () => resolve(result));
    await press('Save to diary');

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)[0]).toMatchObject({
      inputText: 'mint tea',
      mealName: 'Mint tea',
    });
  });

  it('does not save twice on a double tap', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check it');
    await screen.findByText('Mint is a common trigger.');

    const save = screen.getByRole('button', { name: 'Save to diary' });
    await fireEvent.press(save);
    await fireEvent.press(save);

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(1);
  });

  it('shows the friendly message for a relay error and keeps the typed text', async () => {
    analyze.mockRejectedValue(new AppError('RATE_LIMITED', 'req-1'));
    await render(<LogFoodScreen />);

    await type('toast');
    await press('Check it');

    expect(await screen.findByText(friendlyMessages.RATE_LIMITED)).toBeTruthy();
    expect(screen.getByLabelText('What did you eat?').props.value).toBe('toast');
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);

    analyze.mockResolvedValue(result);
    await press('Try again');
    await waitFor(() => expect(screen.getByText('Mint is a common trigger.')).toBeTruthy());
  });

  it('treats an unexpected error as INTERNAL', async () => {
    analyze.mockRejectedValue(new Error('boom'));
    await render(<LogFoodScreen />);

    await type('toast');
    await press('Check it');

    expect(await screen.findByText(friendlyMessages.INTERNAL)).toBeTruthy();
  });

  it('"Try something else" returns to the input without saving', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check it');
    await screen.findByText('Mint is a common trigger.');

    await press('Try something else');

    expect(screen.getByLabelText('What did you eat?')).toBeTruthy();
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
  });
});
