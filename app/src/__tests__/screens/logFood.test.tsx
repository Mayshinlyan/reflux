import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import LogFoodScreen from '@/app/log/food';
import { createTestDb } from '@/db/__tests__/testDb';
import { listDiaryFoodLogs } from '@/db/repositories/food';
import type { AppDb } from '@/db/types';
import { AppError, friendlyMessages } from '@/lib/errors';
import { pickFoodPhoto } from '@/services/photoPicker';
import { deletePhoto, savePhoto } from '@/services/photoStore';
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
// The real loader animates with Reanimated, which needs a native runtime; its own test covers it.
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
const removePhoto = deletePhoto as jest.Mock;

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
/** A photo now stops at a review step (with optional details) until "Analyze meal". */
const reviewThenCheck = async () => {
  await screen.findByLabelText('Anything we should know?');
  await press('Analyze meal');
};

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockBack.mockClear();
  mockToast.mockClear();
  analyze.mockReset();
  pick.mockReset();
  store.mockReset().mockReturnValue('file:///doc/photos/meal.jpg');
  removePhoto.mockReset();
});

afterEach(() => closeDb());

describe('Log food screen (text)', () => {
  it('keeps "Check it" disabled until something is typed', async () => {
    await render(<LogFoodScreen />);
    expect(screen.getByRole('button', { name: 'Analyze meal' })).toBeDisabled();
    await type('   ');
    expect(screen.getByRole('button', { name: 'Analyze meal' })).toBeDisabled();
  });

  it('analyzes the trimmed text, shows the result, and saves it to the diary', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);

    await type('  mint tea ');
    await press('Analyze meal');

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

  it('shows the loader instead of the form while the relay works, then the result', async () => {
    let resolve!: (value: unknown) => void;
    analyze.mockReturnValue(new Promise((r) => (resolve = r)));
    await render(<LogFoodScreen />);
    await type('dim sum');
    await press('Analyze meal');

    expect(screen.getByText('loading:text')).toBeTruthy();
    expect(screen.queryByLabelText('What did you eat?')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Take a photo' })).toBeNull();

    await act(async () => resolve(result));
    expect(await screen.findByText('Mint is a common trigger.')).toBeTruthy();
    expect(screen.queryByText('loading:text')).toBeNull();
  });

  it('keeps Save on screen outside the scrolling result, however long the meal is', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('dim sum');
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');

    const insideScroll = (element: { parent: unknown; type: unknown } | null): boolean =>
      element !== null && (element.type === 'RCTScrollView' || insideScroll(element.parent as never));
    const save = screen.getByRole('button', { name: 'Save to diary' });
    expect(insideScroll(save)).toBe(false);
    // The card itself does scroll, so the check above is meaningful.
    expect(insideScroll(screen.getByText('Mint is a common trigger.'))).toBe(true);
  });

  it('does not save twice on a double tap', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Analyze meal');
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
    await press('Analyze meal');

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
    await press('Analyze meal');

    expect(await screen.findByText(friendlyMessages.INTERNAL)).toBeTruthy();
  });

  it('"Try something else" returns to the input without saving', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');

    await press('Try something else');

    expect(screen.getByLabelText('What did you eat?')).toBeTruthy();
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
  });
});

describe('Log food screen (photo)', () => {
  const photo = { uri: 'file:///cache/prepared.jpg', width: 1024, height: 768 };

  it('sends the prepared photo, then stores it and saves the diary entry', async () => {
    pick.mockResolvedValue({ status: 'ok', photo });
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);

    await press('Take a photo');
    expect(analyze).not.toHaveBeenCalled(); // waits for the review step
    await reviewThenCheck();
    expect(await screen.findByText('Mint is a common trigger.')).toBeTruthy();
    expect(pick).toHaveBeenCalledWith('camera', expect.any(Function));
    expect(analyze).toHaveBeenCalledWith(
      { photo: { uri: photo.uri, mimeType: 'image/jpeg' } },
      expect.any(AbortSignal),
    );

    await press('Save to diary');

    expect(store).toHaveBeenCalledWith(photo.uri);
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)[0]).toMatchObject({
      source: 'photo',
      photoUri: 'file:///doc/photos/meal.jpg',
      inputText: null,
      mealName: 'Mint tea',
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('shows the photo loader while the photo is prepared and analyzed', async () => {
    let resolve!: (value: unknown) => void;
    analyze.mockReturnValue(new Promise((r) => (resolve = r)));
    pick.mockResolvedValue({ status: 'ok', photo });
    await render(<LogFoodScreen />);

    await press('Take a photo');
    await reviewThenCheck();

    expect(await screen.findByText('loading:photo')).toBeTruthy();
    await act(async () => resolve(result));
    await screen.findByText('Mint is a common trigger.');
  });

  it('keeps the form while the system picker is open and shows the review step once a photo is chosen', async () => {
    let choose!: (result: unknown) => void;
    let onPicked!: () => void;
    pick.mockImplementation((_source: string, callback: () => void) => {
      onPicked = callback;
      return new Promise((resolve) => (choose = resolve));
    });
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);

    await press('Take a photo');
    // The picker is on screen: the app behind it must not flash a loader.
    expect(screen.queryByText('loading:photo')).toBeNull();
    expect(screen.getByRole('button', { name: 'Take a photo' })).toBeTruthy();

    await act(async () => onPicked());
    expect(screen.getByText('loading:photo')).toBeTruthy(); // preparing the photo

    await act(async () => choose({ status: 'ok', photo }));
    expect(await screen.findByLabelText('Anything we should know?')).toBeTruthy();
    expect(screen.queryByText('loading:photo')).toBeNull();
    await press('Analyze meal');
    expect(await screen.findByText('Mint is a common trigger.')).toBeTruthy();
  });

  it('can pick from the library', async () => {
    pick.mockResolvedValue({ status: 'ok', photo });
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);

    await press('Choose a photo');
    await reviewThenCheck();

    await screen.findByText('Mint is a common trigger.');
    expect(pick).toHaveBeenCalledWith('library', expect.any(Function));
  });

  it('explains a denied camera permission and does not analyze', async () => {
    pick.mockResolvedValue({ status: 'denied' });
    await render(<LogFoodScreen />);

    await press('Take a photo');

    expect(await screen.findByText(/Camera access is off/)).toBeTruthy();
    expect(analyze).not.toHaveBeenCalled();
  });

  it('does nothing when the picker is cancelled', async () => {
    pick.mockResolvedValue({ status: 'canceled' });
    await render(<LogFoodScreen />);

    await press('Take a photo');

    expect(analyze).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Take a photo' })).toBeEnabled();
  });

  it('shows a friendly message when the photo cannot be read', async () => {
    pick.mockRejectedValue(new Error('file:///private/path failed'));
    await render(<LogFoodScreen />);

    await press('Choose a photo');

    expect(await screen.findByText(friendlyMessages.INPUT_REJECTED)).toBeTruthy();
    expect(screen.queryByText(/private\/path/)).toBeNull();
    expect(analyze).not.toHaveBeenCalled();
  });

  it('shows the relay error for a photo and lets you pick again', async () => {
    pick.mockResolvedValue({ status: 'ok', photo });
    analyze.mockRejectedValue(new AppError('NOT_FOOD'));
    await render(<LogFoodScreen />);

    await press('Take a photo');
    await reviewThenCheck();

    expect(await screen.findByText(friendlyMessages.NOT_FOOD)).toBeTruthy();
    // The photo stays, so the user can retry or pick another.
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    await press('Choose a different photo');
    expect(screen.getByRole('button', { name: 'Take a photo' })).toBeEnabled();
  });

  it('removes the stored photo if the diary entry cannot be saved', async () => {
    pick.mockResolvedValue({ status: 'ok', photo });
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await press('Take a photo');
    await reviewThenCheck();
    await screen.findByText('Mint is a common trigger.');

    closeDb();
    await press('Save to diary');

    expect(removePhoto).toHaveBeenCalledWith('file:///doc/photos/meal.jpg');
    expect(mockToast).toHaveBeenCalledWith("We couldn't save that. Please try again.");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('sends optional details typed on the review step along with the photo', async () => {
    pick.mockResolvedValue({ status: 'ok', photo });
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);

    await press('Take a photo');
    await fireEvent.changeText(
      await screen.findByLabelText('Anything we should know?'),
      '  homemade, no chili ',
    );
    await press('Analyze meal');

    await screen.findByText('Mint is a common trigger.');
    expect(analyze).toHaveBeenCalledWith(
      { photo: { uri: photo.uri, mimeType: 'image/jpeg' }, details: 'homemade, no chili' },
      expect.any(AbortSignal),
    );
  });
});

describe('Log food screen (correcting the verdict on save)', () => {
  const photo = { uri: 'file:///cache/prepared.jpg', width: 1024, height: 768 };
  const correctionField = () => screen.getByLabelText('Is this right? Tell us more');
  const corrected = {
    ...result,
    mealName: 'Pumpkin soup',
    overall: { verdict: 'ok', confidence: 'high', reasoning: 'Plain pumpkin soup.' },
  };

  it('has no separate re-check button', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('soup');
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');

    expect(screen.queryByRole('button', { name: /check again/i })).toBeNull();
  });

  it('saves the original verdict without another call when there is no comment', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('soup');
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');
    await press('Save to diary');

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)[0]).toMatchObject({ mealName: 'Mint tea' });
  });

  it('re-checks text with the comment on save and stores the corrected verdict', async () => {
    analyze.mockResolvedValueOnce(result).mockResolvedValueOnce(corrected);
    await render(<LogFoodScreen />);
    await type('soup');
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');

    await fireEvent.changeText(correctionField(), " it's pumpkin, no cream ");
    await press('Save to diary');

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(analyze).toHaveBeenCalledTimes(2);
    expect(analyze).toHaveBeenLastCalledWith({ text: 'soup', details: "it's pumpkin, no cream" });
    const logs = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ mealName: 'Pumpkin soup', overallVerdict: 'ok', inputText: 'soup' });
  });

  it('re-checks a photo with earlier details plus the comment, then saves once', async () => {
    pick.mockResolvedValue({ status: 'ok', photo });
    analyze.mockResolvedValueOnce(result).mockResolvedValueOnce(corrected);
    await render(<LogFoodScreen />);
    await press('Take a photo');
    await fireEvent.changeText(await screen.findByLabelText('Anything we should know?'), 'homemade');
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');

    await fireEvent.changeText(correctionField(), 'it is pumpkin soup');
    await press('Save to diary');

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(analyze).toHaveBeenLastCalledWith({
      photo: { uri: photo.uri, mimeType: 'image/jpeg' },
      details: 'homemade. it is pumpkin soup',
    });
    expect(store).toHaveBeenCalledTimes(1);
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(1);
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)[0]).toMatchObject({ mealName: 'Pumpkin soup' });
  });

  it('shows the loader while re-checking on save', async () => {
    let resolve!: (value: unknown) => void;
    analyze.mockResolvedValueOnce(result).mockReturnValueOnce(new Promise((r) => (resolve = r)));
    await render(<LogFoodScreen />);
    await type('soup');
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');
    await fireEvent.changeText(correctionField(), 'pumpkin');
    await press('Save to diary');

    expect(await screen.findByText('loading:correction')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save to diary' })).toBeNull();
    await act(async () => resolve(corrected));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
  });

  it('saves nothing and keeps the result and comment if the re-check fails', async () => {
    analyze.mockResolvedValueOnce(result).mockRejectedValueOnce(new AppError('RATE_LIMITED', 'req-2'));
    await render(<LogFoodScreen />);
    await type('soup');
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');
    await fireEvent.changeText(correctionField(), 'pumpkin');
    await press('Save to diary');

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(friendlyMessages.RATE_LIMITED));
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByText('Mint is a common trigger.')).toBeTruthy();
    expect(correctionField().props.value).toBe('pumpkin');
  });
});
