import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import LogFoodScreen from '@/app/log/food';
import { createTestDb } from '@/db/__tests__/testDb';
import { listDiaryFoodLogs } from '@/db/repositories/food';
import { createSavedFood, listSavedFoods } from '@/db/repositories/savedFoods';
import { foodLogs } from '@/db/schema';
import type { AppDb } from '@/db/types';
import { AppError, friendlyMessages } from '@/lib/errors';
import { pickFoodPhoto } from '@/services/photoPicker';
import { deletePhoto, savePhoto } from '@/services/photoStore';
import { analyzeFood } from '@/services/relayClient';

let mockDb: AppDb;
let closeDb: () => void;
const mockBack = jest.fn();
const mockToast = jest.fn();
let mockParams: { camera?: string; myFood?: string; food?: string; check?: string } = {};

jest.mock('@/db/DatabaseProvider', () => ({ useDb: () => mockDb }));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('@/components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('@/services/relayClient', () => ({ analyzeFood: jest.fn() }));
jest.mock('@/services/photoPicker', () => ({ pickFoodPhoto: jest.fn() }));
jest.mock('@/services/photoStore', () => ({ savePhoto: jest.fn(), deletePhoto: jest.fn() }));
jest.mock('expo-image', () => ({ Image: () => null }));
// The native wheel can't render here: the stand-in keeps its latest props so a test can "turn" it.
let mockWheel: {
  value: Date;
  minimumDate: Date;
  maximumDate: Date;
  onValueChange: (event: unknown, date: Date) => void;
} | null = null;
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: NonNullable<typeof mockWheel>) => {
    mockWheel = props;
    return null;
  },
  DateTimePickerAndroid: { open: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// The real loader animates with Reanimated, which needs a native runtime; its own test covers it.
jest.mock('@/components/FoodLoading', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  return { FoodLoading: ({ source }: { source: string }) => <Text>{`loading:${source}`}</Text> };
});
jest.mock('expo-router', () => ({
  router: { back: () => mockBack(), canGoBack: () => true, replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
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
/** "I ate this" now asks when first; leaving the wheel alone saves it as eaten right now. */
const ateThis = async () => {
  await press('I ate this');
  await press('Save');
};
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
  mockParams = {};
  analyze.mockReset();
  pick.mockReset();
  store.mockReset().mockReturnValue('file:///doc/photos/meal.jpg');
  removePhoto.mockReset();
});

afterEach(() => closeDb());

describe('Log food screen: Save to My foods', () => {
  const checkMintTea = async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');
  };

  it('saves the checked meal to My foods too, with its verdict, when ticked', async () => {
    await checkMintTea();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Save to My foods' }));
    await ateThis();

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toMatchObject([{ mealName: 'Mint tea' }]);
    expect(listSavedFoods(mockDb)).toMatchObject([{ mealName: 'Mint tea', overallVerdict: 'caution' }]);
    expect(mockToast).toHaveBeenCalledWith('Added to your food diary and My foods');
  });

  it('leaves My foods alone when not ticked', async () => {
    await checkMintTea();

    await ateThis();

    expect(listSavedFoods(mockDb)).toHaveLength(0);
    expect(mockToast).toHaveBeenCalledWith('Added to your food diary');
  });
});

describe('Log food screen: "Add a food" from the Food list', () => {
  // The food may not have been eaten yet, so the field asks "What's the food?".
  const typeFood = async (value: string) =>
    fireEvent.changeText(screen.getByLabelText("What's the food?"), value);

  beforeEach(() => {
    mockParams = { check: '1' };
  });

  it('saves the verdict to My foods only, without adding a meal to the diary', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await typeFood('mint tea');
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');

    await press('Save to My foods only');

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(listSavedFoods(mockDb)).toMatchObject([{ mealName: 'Mint tea', overallVerdict: 'caution' }]);
    expect(mockToast).toHaveBeenCalledWith('Mint tea added to My foods');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('can still log it as eaten, and keep it too', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await typeFood('mint tea');
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Save to My foods' }));
    await ateThis();

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(1);
    expect(listSavedFoods(mockDb)).toHaveLength(1);
  });

  it('saves a typed food to My foods by name when skipping the verdict', async () => {
    await render(<LogFoodScreen />);
    await typeFood('Banana bread');

    await press('Save without a verdict');

    expect(analyze).not.toHaveBeenCalled();
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(listSavedFoods(mockDb).map((food) => food.mealName)).toEqual(['Banana bread']);
    expect(mockToast).toHaveBeenCalledWith('Banana bread added to My foods');
  });
});

describe('Log food screen (text)', () => {
  it('shows the actions only once something is typed', async () => {
    await render(<LogFoodScreen />);
    expect(screen.queryByRole('button', { name: 'Analyze meal' })).toBeNull();
    await type('   ');
    expect(screen.queryByRole('button', { name: 'Analyze meal' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save without a verdict' })).toBeNull();
    await type('toast');
    expect(screen.getByRole('button', { name: 'Analyze meal' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save without a verdict' })).toBeTruthy();
  });

  it('analyzes the trimmed text, shows the result, and saves it to the diary', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);

    await type('  mint tea ');
    await press('Analyze meal');

    expect(await screen.findByText('Mint is a common trigger.')).toBeTruthy();
    expect(analyze).toHaveBeenCalledWith({ text: 'mint tea' }, expect.any(AbortSignal));

    await ateThis();

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
    expect(mockToast).toHaveBeenCalledWith('Added to your food diary');
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
    const save = screen.getByRole('button', { name: 'I ate this' });
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

    await press('I ate this');
    const save = screen.getByRole('button', { name: 'Save' });
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

  it('"Not now" closes the screen without adding to the diary', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');

    await press('Not now');

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(mockToast).not.toHaveBeenCalled();
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

    await ateThis();

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

  it('keeps the photo with its stored check if "I ate this" cannot save', async () => {
    pick.mockResolvedValue({ status: 'ok', photo });
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await press('Take a photo');
    await reviewThenCheck();
    await screen.findByText('Mint is a common trigger.');

    closeDb();
    await ateThis();

    // Saved with the check when the result arrived; that check still references it.
    expect(removePhoto).not.toHaveBeenCalled();
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

describe('Food screen (updating the verdict with a comment)', () => {
  const photo = { uri: 'file:///cache/prepared.jpg', width: 1024, height: 768 };
  const correctionField = () => screen.getByLabelText('Is this right? Tell us more');
  const corrected = {
    ...result,
    mealName: 'Pumpkin soup',
    overall: { verdict: 'ok', confidence: 'high', reasoning: 'Plain pumpkin soup.' },
  };

  const analyzeSoup = async () => {
    await render(<LogFoodScreen />);
    await type('soup');
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');
  };

  it('saves the verdict on screen without another call when there is no comment', async () => {
    analyze.mockResolvedValue(result);
    await analyzeSoup();
    await ateThis();

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)[0]).toMatchObject({ mealName: 'Mint tea' });
  });

  it('turns "I ate this" into "Update verdict" while there is a comment', async () => {
    analyze.mockResolvedValue(result);
    await analyzeSoup();

    await fireEvent.changeText(correctionField(), 'pumpkin');
    expect(screen.getByRole('button', { name: 'Update verdict' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'I ate this' })).toBeNull();

    await fireEvent.changeText(correctionField(), '   ');
    expect(screen.getByRole('button', { name: 'I ate this' })).toBeTruthy();
  });

  it('shows the updated verdict before saving, then saves it with no further call', async () => {
    analyze.mockResolvedValueOnce(result).mockResolvedValueOnce(corrected);
    await analyzeSoup();

    await fireEvent.changeText(correctionField(), " it's pumpkin, no cream ");
    await press('Update verdict');

    expect(await screen.findByText('Plain pumpkin soup.')).toBeTruthy();
    expect(analyze).toHaveBeenLastCalledWith({ text: 'soup', details: "it's pumpkin, no cream" });
    expect(correctionField().props.value).toBe('');
    expect(mockToast).toHaveBeenCalledWith('Verdict updated');
    // Shown, not saved: the check holds the new verdict, the diary is still empty.
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(mockDb.select().from(foodLogs).all()).toMatchObject([
      { entryType: 'check', mealName: 'Pumpkin soup', overallVerdict: 'ok' },
    ]);
    expect(mockBack).not.toHaveBeenCalled();

    await ateThis();

    expect(analyze).toHaveBeenCalledTimes(2);
    const logs = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ mealName: 'Pumpkin soup', overallVerdict: 'ok', inputText: 'soup' });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('builds each update on earlier details and comments', async () => {
    pick.mockResolvedValue({ status: 'ok', photo });
    analyze.mockResolvedValueOnce(result).mockResolvedValueOnce(corrected).mockResolvedValueOnce(corrected);
    await render(<LogFoodScreen />);
    await press('Take a photo');
    await fireEvent.changeText(await screen.findByLabelText('Anything we should know?'), 'homemade');
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');

    await fireEvent.changeText(correctionField(), 'it is pumpkin soup');
    await press('Update verdict');
    await screen.findByText('Plain pumpkin soup.');
    await fireEvent.changeText(correctionField(), 'no cream');
    await press('Update verdict');
    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(3));

    expect(analyze).toHaveBeenLastCalledWith({
      photo: { uri: photo.uri, mimeType: 'image/jpeg' },
      details: 'homemade. it is pumpkin soup. no cream',
    });
    await screen.findByRole('button', { name: 'I ate this' });
    await ateThis();
    expect(store).toHaveBeenCalledTimes(1);
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toMatchObject([{ mealName: 'Pumpkin soup' }]);
  });

  it('shows the loader while updating the verdict', async () => {
    let resolve!: (value: unknown) => void;
    analyze.mockResolvedValueOnce(result).mockReturnValueOnce(new Promise((r) => (resolve = r)));
    await analyzeSoup();
    await fireEvent.changeText(correctionField(), 'pumpkin');
    await press('Update verdict');

    expect(await screen.findByText('loading:correction')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Update verdict' })).toBeNull();
    await act(async () => resolve(corrected));
    expect(await screen.findByText('Plain pumpkin soup.')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('keeps the verdict and the comment if the update fails', async () => {
    analyze.mockResolvedValueOnce(result).mockRejectedValueOnce(new AppError('RATE_LIMITED', 'req-2'));
    await analyzeSoup();
    await fireEvent.changeText(correctionField(), 'pumpkin');
    await press('Update verdict');

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(friendlyMessages.RATE_LIMITED));
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByText('Mint is a common trigger.')).toBeTruthy();
    expect(correctionField().props.value).toBe('pumpkin');
  });
});

describe('Food screen for My foods', () => {
  const photo = { uri: 'file:///cache/prepared.jpg', width: 1024, height: 768 };

  it('checks a photo and saves it with its verdict to My foods, not the diary', async () => {
    mockParams = { myFood: '1' };
    pick.mockResolvedValue({ status: 'ok', photo });
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);

    expect(screen.getByRole('header', { name: 'Add a food' })).toBeTruthy();
    await press('Take a photo');
    await screen.findByLabelText('Anything we should know?');
    expect(screen.queryByRole('button', { name: 'Save without a verdict' })).toBeNull();
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');
    await press('Save to My foods');

    expect(listSavedFoods(mockDb)).toMatchObject([
      {
        mealName: 'Mint tea',
        source: 'photo',
        photoUri: 'file:///doc/photos/meal.jpg',
        overallVerdict: 'caution',
      },
    ]);
    // Neither a diary meal nor a stored check.
    expect(mockDb.select().from(foodLogs).all()).toHaveLength(0);
    expect(mockToast).toHaveBeenCalledWith('Mint tea added to My foods');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('can still add a typed food by name without a verdict', async () => {
    mockParams = { myFood: '1' };
    createSavedFood(mockDb, 'Oatmeal');
    await render(<LogFoodScreen />);

    expect(screen.queryByRole('header', { name: 'My foods' })).toBeNull();
    // A saved food isn't eaten, so there is no meal time to pick.
    expect(screen.queryByRole('button', { name: /^When did you eat this\?/ })).toBeNull();
    expect(screen.queryByLabelText('What did you eat?')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("What's the food?"), '  Banana bread ');
    await press('Save without a verdict');

    expect(listSavedFoods(mockDb).map((food) => food.mealName)).toEqual(['Banana bread', 'Oatmeal']);
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(analyze).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith('Banana bread added to My foods');
  });

  it('gives a saved food a verdict, starting from its name and keeping it', async () => {
    const id = createSavedFood(mockDb, 'My tea');
    mockParams = { myFood: '1', food: String(id) };
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);

    expect(screen.getByRole('header', { name: 'Get a verdict' })).toBeTruthy();
    expect(screen.getByLabelText("What's the food?").props.value).toBe('My tea');
    expect(screen.queryByRole('button', { name: 'Save without a verdict' })).toBeNull();
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');
    await press('Save to My foods');

    expect(listSavedFoods(mockDb)).toMatchObject([{ id, mealName: 'My tea', overallVerdict: 'caution' }]);
    expect(mockToast).toHaveBeenCalledWith('Updated My tea in My foods');
  });
});

describe('Log food screen: asking when it was eaten', () => {
  /** Yesterday at 8:15 AM, local time: always in the past whenever the test runs. */
  const yesterdayBreakfast = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 8, 15);
  };
  const turnWheel = async (date: Date) => act(() => mockWheel?.onValueChange({}, date));
  const checkMintTea = async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Analyze meal');
    await screen.findByText('Mint is a common trigger.');
  };

  beforeEach(() => {
    mockWheel = null;
  });

  it('has no time picker up front', async () => {
    await render(<LogFoodScreen />);
    expect(screen.queryByRole('button', { name: /^When did you eat this\?/ })).toBeNull();
    expect(screen.queryByText('When did you eat this?')).toBeNull();
  });

  it('asks when it was eaten after the verdict, in a wheel limited to the past week', async () => {
    await checkMintTea();
    await press('I ate this');

    expect(screen.getByText('When did you eat this?')).toBeTruthy();
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    const now = new Date();
    expect(mockWheel?.maximumDate.getTime()).toBeLessThanOrEqual(Date.now());
    expect(mockWheel?.minimumDate).toEqual(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  });

  it('saves "I ate this" at the chosen time', async () => {
    await checkMintTea();
    await press('I ate this');
    await turnWheel(yesterdayBreakfast());
    await press('Save');

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(meal.loggedAt).toBe(yesterdayBreakfast().toISOString());
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('saves as eaten right now when the wheel is left alone', async () => {
    await checkMintTea();
    const before = Date.now();
    await ateThis();

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(new Date(meal.loggedAt).getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(new Date(meal.loggedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('saves nothing if the sheet is dismissed', async () => {
    await checkMintTea();
    await press('I ate this');
    await fireEvent.press(screen.getByLabelText('Close', { includeHiddenElements: true }));

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'I ate this' })).toBeTruthy();
  });

  it('asks too before "Save without a verdict", and saves at the chosen time', async () => {
    await render(<LogFoodScreen />);
    await type('toast and eggs');

    await press('Save without a verdict');
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    await turnWheel(yesterdayBreakfast());
    await press('Save');

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(meal.mealName).toBe('toast and eggs');
    expect(meal.loggedAt).toBe(yesterdayBreakfast().toISOString());
  });

  it('never saves a time that has not happened yet', async () => {
    await render(<LogFoodScreen />);
    await type('toast');
    await press('Save without a verdict');
    await turnWheel(new Date(Date.now() + 60 * 60 * 1000));
    await press('Save');

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(new Date(meal.loggedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });
});
