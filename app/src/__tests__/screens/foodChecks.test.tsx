import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import LogFoodScreen from '@/app/log/food';
import { createTestDb } from '@/db/__tests__/testDb';
import { listDiaryFoodLogs } from '@/db/repositories/food';
import { foodLogs } from '@/db/schema';
import type { AppDb } from '@/db/types';
import { AppError, friendlyMessages } from '@/lib/errors';
import { pickFoodPhoto } from '@/services/photoPicker';
import { savePhoto } from '@/services/photoStore';
import { analyzeFood } from '@/services/relayClient';

let mockDb: AppDb;
let closeDb: () => void;
const mockBack = jest.fn();
const mockToast = jest.fn();
let mockParams: { camera?: string } = {};

jest.mock('@/db/DatabaseProvider', () => ({ useDb: () => mockDb }));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('@/components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('@/services/relayClient', () => ({ analyzeFood: jest.fn() }));
jest.mock('@/services/photoPicker', () => ({ pickFoodPhoto: jest.fn() }));
jest.mock('@/services/photoStore', () => ({ savePhoto: jest.fn(), deletePhoto: jest.fn() }));
jest.mock('expo-image', () => ({ Image: () => null }));
// The native wheel can't render here; leaving it alone means "eaten right now".
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/FoodLoading', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  return { FoodLoading: ({ source }: { source: string }) => <Text>{`loading:${source}`}</Text> };
});
jest.mock('expo-router', () => ({
  router: { back: () => mockBack(), dismissTo: () => mockBack(), canGoBack: () => true, replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
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
const type = async (value: string) => fireEvent.changeText(screen.getByLabelText('What did you eat?'), value);
const press = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));
/** Answers the "Any symptoms?" question that follows a saved meal. */
const skipSymptoms = async () => {
  await fireEvent.press(await screen.findByRole('button', { name: 'Not now' }));
  // The sheet closes first, then the screen leaves.
  await waitFor(() => expect(mockBack).toHaveBeenCalled());
};
/** "I ate this" now asks when first; leaving the wheel alone saves it as eaten right now. */
const ateThis = async () => {
  await press('I ate this');
  await press('Save');
};

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockBack.mockClear();
  mockToast.mockClear();
  mockParams = {};
  analyze.mockReset();
  pick.mockReset();
  store.mockReset().mockReturnValue('file:///doc/photos/meal.jpg');
});

afterEach(() => closeDb());

describe('Food screen: checks and "I ate this"', () => {
  it('"mint tea" → Caution citing mint → "I ate this" puts it in the diary with no second relay call', async () => {
    analyze.mockResolvedValue(mintTea);
    await render(<LogFoodScreen />);
    expect(screen.getByText('Log food')).toBeTruthy();

    await type('mint tea');
    await press('Analyze meal');

    expect(await screen.findByText('Mint is a common trigger.')).toBeTruthy();
    expect(screen.getAllByText('Caution').length).toBeGreaterThan(0);
    // Checked, not eaten: stored as a check, outside the diary (and so the pet).
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(allRows()).toMatchObject([{ entryType: 'check', inputText: 'mint tea' }]);

    await ateThis();

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
    expect(diary[0].analysis?.items[0].matchedTriggers[0]?.category).toBe('mint');
    expect(allRows()).toHaveLength(1); // the check itself was promoted, not copied
    expect(mockToast).toHaveBeenCalledWith('Added to your food diary');
    await skipSymptoms();
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('keeps the check, outside the diary, after "Not now"', async () => {
    analyze.mockResolvedValue(mintTea);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');

    await press('Not now');

    expect(allRows()).toMatchObject([{ mealName: 'Mint tea', entryType: 'check' }]);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('opens the camera straight away when reached from Scan, once', async () => {
    mockParams = { camera: '1' };
    pick.mockResolvedValue({ status: 'canceled' });
    await render(<LogFoodScreen />);

    await waitFor(() => expect(pick).toHaveBeenCalledWith('camera', expect.any(Function)));
    // Cancelling leaves the full screen to choose from, without re-opening the camera.
    expect(await screen.findByRole('button', { name: 'Choose a photo' })).toBeTruthy();
    expect(pick).toHaveBeenCalledTimes(1);
  });

  it('does not open the camera when reached from the + menu', async () => {
    await render(<LogFoodScreen />);
    expect(pick).not.toHaveBeenCalled();
  });

  it('updates the stored check with a comment, then promotes that same check', async () => {
    analyze.mockResolvedValueOnce(mintTea).mockResolvedValueOnce(chamomile);
    await render(<LogFoodScreen />);
    await type('herbal tea');
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');

    await fireEvent.changeText(screen.getByLabelText('Is this right? Tell us more'), 'it was chamomile');
    await press('Update verdict');
    await screen.findByText('Chamomile is usually gentle.');
    expect(allRows()).toMatchObject([{ entryType: 'check', mealName: 'Chamomile tea' }]);

    await ateThis();

    expect(analyze).toHaveBeenCalledTimes(2);
    expect(analyze).toHaveBeenLastCalledWith({ text: 'herbal tea', details: 'it was chamomile' });
    expect(allRows()).toMatchObject([
      { entryType: 'diary', mealName: 'Chamomile tea', overallVerdict: 'ok', inputText: 'herbal tea' },
    ]);
  });

  it('stores a checked photo once and reuses it on "I ate this"', async () => {
    pick.mockResolvedValue({ status: 'ok', photo: { uri: 'file:///cache/prepared.jpg' } });
    analyze.mockResolvedValue(mintTea);
    await render(<LogFoodScreen />);

    await press('Take a photo');
    await screen.findByLabelText('Anything we should know?');
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');
    await ateThis();

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
    await render(<LogFoodScreen />);

    await press('Choose a photo');
    await screen.findByLabelText('Anything we should know?');
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');
    expect(allRows()).toHaveLength(0);

    await ateThis();

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(allRows()).toMatchObject([{ entryType: 'diary', photoUri: 'file:///doc/photos/meal.jpg' }]);
  });
});

describe('Food screen: saving without a verdict', () => {
  it('saves a typed meal as a diary entry with no verdict and never calls the relay', async () => {
    await render(<LogFoodScreen />);
    expect(screen.queryByRole('button', { name: 'Save without a verdict' })).toBeNull();

    await type('  grilled fish  ');
    await press('Save without a verdict');
    await press('Save');

    expect(analyze).not.toHaveBeenCalled();
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toMatchObject([
      {
        entryType: 'diary',
        source: 'text',
        inputText: 'grilled fish',
        mealName: 'grilled fish',
        overallVerdict: null,
        analysis: null,
        analysisMeta: null,
      },
    ]);
    expect(mockToast).toHaveBeenCalledWith('Saved without a verdict');
    await skipSymptoms();
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('offers only the check after a photo is taken, not saving it unchecked or swapping the photo', async () => {
    pick.mockResolvedValue({ status: 'ok', photo: { uri: 'file:///cache/prepared.jpg' } });
    await render(<LogFoodScreen />);
    await press('Choose a photo');

    expect(screen.getByRole('button', { name: 'Analyze meal' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save without a verdict' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Choose a different photo' })).toBeNull();
    expect(analyze).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
  });

  it('still offers it after an offline failure, and saves the typed text', async () => {
    analyze.mockRejectedValue(new AppError('OFFLINE'));
    await render(<LogFoodScreen />);
    await type('rice and beans');
    await press('Analyze meal');
    expect(await screen.findByText(friendlyMessages.OFFLINE)).toBeTruthy();

    await press('Save without a verdict');
    await press('Save');

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toMatchObject([
      { inputText: 'rice and beans', overallVerdict: null },
    ]);
  });
});
