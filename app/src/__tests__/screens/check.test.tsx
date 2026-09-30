import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import CheckScreen from '@/app/check';
import { createTestDb } from '@/db/__tests__/testDb';
import { listDiaryFoodLogs } from '@/db/repositories/food';
import { foodLogs } from '@/db/schema';
import type { AppDb } from '@/db/types';
import { pickFoodPhoto } from '@/services/photoPicker';
import { savePhoto } from '@/services/photoStore';
import { analyzeFood } from '@/services/relayClient';

let mockDb: AppDb;
let closeDb: () => void;
const mockBack = jest.fn();
const mockToast = jest.fn();

jest.mock('@/db/DatabaseProvider', () => ({ useDb: () => mockDb }));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('@/components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('@/services/relayClient', () => ({ analyzeFood: jest.fn() }));
jest.mock('@/services/photoPicker', () => ({ pickFoodPhoto: jest.fn() }));
jest.mock('@/services/photoStore', () => ({ savePhoto: jest.fn(), deletePhoto: jest.fn() }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/components/FoodLoading', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  return { FoodLoading: ({ source }: { source: string }) => <Text>{`loading:${source}`}</Text> };
});
jest.mock('expo-router', () => ({
  router: { back: () => mockBack(), canGoBack: () => true, replace: jest.fn() },
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));

const analyze = analyzeFood as jest.Mock;
const pick = pickFoodPhoto as jest.Mock;
const store = savePhoto as jest.Mock;

const mintTea = {
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
const chamomile = {
  ...mintTea,
  mealName: 'Chamomile tea',
  items: [{ ...mintTea.items[0], name: 'Chamomile tea', verdict: 'ok', matchedTriggers: [] }],
  overall: { verdict: 'ok', confidence: 'high', reasoning: 'Chamomile is usually gentle.' },
};

const ALL_TIME = { from: '2000-01-01T00:00:00.000Z', to: '2100-01-01T00:00:00.000Z' };
const allRows = () => mockDb.select().from(foodLogs).all();
const type = async (value: string) =>
  fireEvent.changeText(screen.getByLabelText('What are you thinking of eating?'), value);
const press = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockBack.mockClear();
  mockToast.mockClear();
  analyze.mockReset();
  pick.mockReset();
  store.mockReset().mockReturnValue('file:///doc/photos/meal.jpg');
});

afterEach(() => closeDb());

describe('Check screen', () => {
  it('"mint tea" → Caution citing mint → "I ate this" puts it in the diary with no second relay call', async () => {
    analyze.mockResolvedValue(mintTea);
    await render(<CheckScreen />);
    expect(screen.getByText('Check a food')).toBeTruthy();

    await type('mint tea');
    await press('Check it');

    expect(await screen.findByText('Mint is a common trigger.')).toBeTruthy();
    expect(screen.getAllByText('Caution').length).toBeGreaterThan(0);
    // Checked, not eaten: stored as a check, outside the diary (and so the pet).
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(allRows()).toMatchObject([{ entryType: 'check', inputText: 'mint tea' }]);

    await press('I ate this');

    expect(analyze).toHaveBeenCalledTimes(1);
    const diary = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(diary).toHaveLength(1);
    expect(diary[0]).toMatchObject({
      source: 'text',
      inputText: 'mint tea',
      mealName: 'Mint tea',
      overallVerdict: 'caution',
      analysisMeta: mintTea.meta,
    });
    expect(diary[0].analysis.items[0].matchedTriggers[0].category).toBe('mint');
    expect(allRows()).toHaveLength(1); // the check itself was promoted, not copied
    expect(mockToast).toHaveBeenCalledWith('Saved to your food diary');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('keeps a check out of the diary when the user tries something else', async () => {
    analyze.mockResolvedValueOnce(mintTea).mockResolvedValueOnce(chamomile);
    await render(<CheckScreen />);
    await type('mint tea');
    await press('Check it');
    await screen.findByText('Mint is a common trigger.');

    await press('Try something else');
    await type('chamomile tea');
    await press('Check it');
    await screen.findByText('Chamomile is usually gentle.');
    await press('I ate this');

    expect(allRows().map((row) => [row.mealName, row.entryType])).toEqual([
      ['Mint tea', 'check'],
      ['Chamomile tea', 'diary'],
    ]);
  });

  it('re-checks with a comment and saves the corrected verdict into the promoted check', async () => {
    analyze.mockResolvedValueOnce(mintTea).mockResolvedValueOnce(chamomile);
    await render(<CheckScreen />);
    await type('herbal tea');
    await press('Check it');
    await screen.findByText('Mint is a common trigger.');

    await fireEvent.changeText(screen.getByLabelText('Is this right? Tell us more'), 'it was chamomile');
    await press('I ate this');
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));

    expect(analyze).toHaveBeenLastCalledWith({ text: 'herbal tea', details: 'it was chamomile' });
    expect(allRows()).toMatchObject([
      { entryType: 'diary', mealName: 'Chamomile tea', overallVerdict: 'ok', inputText: 'herbal tea' },
    ]);
  });

  it('stores a checked photo once and reuses it on "I ate this"', async () => {
    pick.mockResolvedValue({ status: 'ok', photo: { uri: 'file:///cache/prepared.jpg' } });
    analyze.mockResolvedValue(mintTea);
    await render(<CheckScreen />);

    await press('Take a photo');
    await screen.findByLabelText('Anything we should know?');
    await press('Check it');
    await screen.findByText('Mint is a common trigger.');
    await press('I ate this');

    expect(store).toHaveBeenCalledTimes(1);
    expect(allRows()).toMatchObject([
      { entryType: 'diary', source: 'photo', photoUri: 'file:///doc/photos/meal.jpg' },
    ]);
  });

  it('still saves to the diary when storing the check failed', async () => {
    pick.mockResolvedValue({ status: 'ok', photo: { uri: 'file:///cache/prepared.jpg' } });
    store.mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    analyze.mockResolvedValue(mintTea);
    await render(<CheckScreen />);

    await press('Choose a photo');
    await screen.findByLabelText('Anything we should know?');
    await press('Check it');
    await screen.findByText('Mint is a common trigger.');
    expect(allRows()).toHaveLength(0);

    await press('I ate this');

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(allRows()).toMatchObject([{ entryType: 'diary', photoUri: 'file:///doc/photos/meal.jpg' }]);
  });
});
