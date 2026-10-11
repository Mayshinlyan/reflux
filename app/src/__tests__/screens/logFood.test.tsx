import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import LogFoodScreen from '@/app/log/food';
import { createTestDb } from '@/db/__tests__/testDb';
import { listDiaryFoodLogs, listMealTags } from '@/db/repositories/food';
import { createSavedFood, listSavedFoods } from '@/db/repositories/savedFoods';
import { listSymptomLogs } from '@/db/repositories/symptoms';
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

jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => ({ settings: { bedtime: '22:30', lateMealWindowMinutes: 180 } }),
}));
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
const type = async (value: string) => fireEvent.changeText(screen.getByLabelText('Describe it'), value);
const press = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));
/** "I ate this" opens the details; Save there logs it as eaten right now. */
const ateThis = async () => {
  await press('I ate this');
  await press('Save');
};
/** The photo card opens a sheet to take a photo or choose one. */
const takePhoto = async () => {
  await press('Take or choose a photo');
  await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));
};
const choosePhoto = async () => {
  await press('Take or choose a photo');
  await fireEvent.press(screen.getByRole('button', { name: 'Choose a photo' }));
};
/** The correction lives in a sheet behind "Not quite right? Tell us more". */
const tellUs = async (value: string) => {
  await press('Not quite right? Tell us more');
  await fireEvent.changeText(screen.getByLabelText('Tell us more'), value);
};
/** A photo now stops at a review step (with optional details) until "Analyze meal". */
const reviewThenCheck = async () => {
  await screen.findByLabelText('Anything we should know?');
  await press('Check this meal');
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
    await press('Check this meal');
    await screen.findByText('Mint is a common trigger.');
  };

  it('saves the checked meal to My foods too, with its verdict, when ticked', async () => {
    await checkMintTea();

    await press('I ate this');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Also save to My foods' }));
    await press('Save');

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
  const typeFood = async (value: string) => fireEvent.changeText(screen.getByLabelText('Describe it'), value);

  beforeEach(() => {
    mockParams = { check: '1' };
  });

  it('saves the verdict to My foods only, without adding a meal to the diary', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await typeFood('mint tea');
    await press('Check this meal');
    await screen.findByText('Mint is a common trigger.');

    await press('Save to My foods only');

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(listSavedFoods(mockDb)).toMatchObject([{ mealName: 'Mint tea', overallVerdict: 'caution' }]);
    expect(mockToast).toHaveBeenCalledWith('Mint tea added to My foods');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('can still log it as eaten, without the "Also save" checkbox (Save to My foods only covers that)', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await typeFood('mint tea');
    await press('Check this meal');
    await screen.findByText('Mint is a common trigger.');

    await press('I ate this');
    expect(screen.queryByRole('checkbox', { name: 'Also save to My foods' })).toBeNull();
    await press('Save');

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(1);
    expect(listSavedFoods(mockDb)).toHaveLength(0);
  });

  it('logs a typed food to the diary, not My foods, when skipping the verdict', async () => {
    await render(<LogFoodScreen />);
    await typeFood('Banana bread');

    await press('Save without a verdict');
    await press('Save');

    expect(analyze).not.toHaveBeenCalled();
    expect(listDiaryFoodLogs(mockDb, ALL_TIME).map((food) => food.mealName)).toEqual(['Banana bread']);
    expect(listSavedFoods(mockDb)).toHaveLength(0);
    expect(mockToast).toHaveBeenCalledWith('Saved without a verdict');
  });
});

describe('Log food screen (text)', () => {
  it('can check only once something is typed, and offers saving without a verdict then', async () => {
    await render(<LogFoodScreen />);
    expect(screen.getByRole('button', { name: 'Check this meal' })).toBeDisabled();
    await type('   ');
    expect(screen.getByRole('button', { name: 'Check this meal' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save without a verdict' })).toBeNull();
    await type('toast');
    expect(screen.getByRole('button', { name: 'Check this meal' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save without a verdict' })).toBeTruthy();
  });

  it('analyzes the trimmed text, shows the result, and saves it to the diary', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);

    await type('  mint tea ');
    await press('Check this meal');

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
    await press('Check this meal');

    expect(screen.getByText('loading:text')).toBeTruthy();
    expect(screen.queryByLabelText('Describe it')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Take or choose a photo' })).toBeNull();

    await act(async () => resolve(result));
    expect(await screen.findByText('Mint is a common trigger.')).toBeTruthy();
    expect(screen.queryByText('loading:text')).toBeNull();
  });

  it('keeps Save on screen outside the scrolling result, however long the meal is', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('dim sum');
    await press('Check this meal');
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
    await press('Check this meal');
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
    await press('Check this meal');

    expect(await screen.findByText(friendlyMessages.RATE_LIMITED)).toBeTruthy();
    expect(screen.getByLabelText('Describe it').props.value).toBe('toast');
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);

    analyze.mockResolvedValue(result);
    await press('Try again');
    await waitFor(() => expect(screen.getByText('Mint is a common trigger.')).toBeTruthy());
  });

  it('treats an unexpected error as INTERNAL', async () => {
    analyze.mockRejectedValue(new Error('boom'));
    await render(<LogFoodScreen />);

    await type('toast');
    await press('Check this meal');

    expect(await screen.findByText(friendlyMessages.INTERNAL)).toBeTruthy();
  });

  it('shows the belly, a headline, why, and the matched triggers on the verdict', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');

    expect(await screen.findByText('Your belly might not love this.')).toBeTruthy();
    expect(screen.getByText('Why we think so')).toBeTruthy();
    expect(screen.getByText('Mint is a common trigger.')).toBeTruthy();
    expect(screen.getByText('Matched triggers')).toBeTruthy();
    expect(screen.getByLabelText('Mint')).toBeTruthy();
    expect(screen.getByLabelText('Belly feels cautious')).toBeTruthy();
  });

  it('goes back from the verdict to the typed text without saving anything', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');
    await screen.findByText('Mint is a common trigger.');

    await press('Back');

    expect(screen.getByLabelText('Describe it').props.value).toBe('mint tea');
    expect(mockBack).not.toHaveBeenCalled();
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('saves the portion, lifestyle tags, symptoms and note from the details', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');
    await screen.findByText('Mint is a common trigger.');

    await press('I ate this');
    await fireEvent.press(screen.getByRole('button', { name: 'Portion, Regular' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Large' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Stress' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Heartburn' }));
    await fireEvent.changeText(screen.getByLabelText('Note'), '  felt heavy ');
    await press('Save');

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(meal).toMatchObject({ portion: 'large', notes: 'felt heavy' });
    expect(listMealTags(mockDb, meal.id)).toEqual(['stress']);
    const [symptomLog] = listSymptomLogs(mockDb, ALL_TIME);
    expect(symptomLog).toMatchObject({ foodLogId: meal.id, loggedAt: meal.loggedAt });
    expect(symptomLog.items.map((item) => item.key)).toEqual(['heartburn']);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('Log food screen (photo)', () => {
  const photo = { uri: 'file:///cache/prepared.jpg', width: 1024, height: 768 };

  it('sends the prepared photo, then stores it and saves the diary entry', async () => {
    pick.mockResolvedValue({ status: 'ok', photo });
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);

    await takePhoto();
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

    await takePhoto();
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

    await takePhoto();
    // The picker is on screen: the app behind it must not flash a loader.
    expect(screen.queryByText('loading:photo')).toBeNull();
    expect(screen.getByRole('button', { name: 'Take or choose a photo' })).toBeTruthy();

    await act(async () => onPicked());
    expect(screen.getByText('loading:photo')).toBeTruthy(); // preparing the photo

    await act(async () => choose({ status: 'ok', photo }));
    expect(await screen.findByLabelText('Anything we should know?')).toBeTruthy();
    expect(screen.queryByText('loading:photo')).toBeNull();
    await press('Check this meal');
    expect(await screen.findByText('Mint is a common trigger.')).toBeTruthy();
  });

  it('can pick from the library', async () => {
    pick.mockResolvedValue({ status: 'ok', photo });
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);

    await choosePhoto();
    await reviewThenCheck();

    await screen.findByText('Mint is a common trigger.');
    expect(pick).toHaveBeenCalledWith('library', expect.any(Function));
  });

  it('explains a denied camera permission and does not analyze', async () => {
    pick.mockResolvedValue({ status: 'denied' });
    await render(<LogFoodScreen />);

    await takePhoto();

    expect(await screen.findByText(/Camera access is off/)).toBeTruthy();
    expect(analyze).not.toHaveBeenCalled();
  });

  it('does nothing when the picker is cancelled', async () => {
    pick.mockResolvedValue({ status: 'canceled' });
    await render(<LogFoodScreen />);

    await takePhoto();

    expect(analyze).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Take or choose a photo' })).toBeEnabled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('goes back to where Scan was tapped when the camera it opened is closed', async () => {
    mockParams = { camera: '1' };
    pick.mockResolvedValue({ status: 'canceled' });
    await render(<LogFoodScreen />);

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(analyze).not.toHaveBeenCalled();
  });

  it('stays on the screen and explains when Scan is denied camera access', async () => {
    mockParams = { camera: '1' };
    pick.mockResolvedValue({ status: 'denied' });
    await render(<LogFoodScreen />);

    expect(await screen.findByText(/Camera access is off/)).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('shows a friendly message when the photo cannot be read', async () => {
    pick.mockRejectedValue(new Error('file:///private/path failed'));
    await render(<LogFoodScreen />);

    await choosePhoto();

    expect(await screen.findByText(friendlyMessages.INPUT_REJECTED)).toBeTruthy();
    expect(screen.queryByText(/private\/path/)).toBeNull();
    expect(analyze).not.toHaveBeenCalled();
  });

  it('shows the relay error for a photo and lets you pick again', async () => {
    pick.mockResolvedValue({ status: 'ok', photo });
    analyze.mockRejectedValue(new AppError('NOT_FOOD'));
    await render(<LogFoodScreen />);

    await takePhoto();
    await reviewThenCheck();

    expect(await screen.findByText(friendlyMessages.NOT_FOOD)).toBeTruthy();
    // The photo stays, so the user can retry; there is no other way out of this step but Back.
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Choose a different photo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save without a verdict' })).toBeNull();
  });

  it('keeps the photo with its stored check if "I ate this" cannot save', async () => {
    pick.mockResolvedValue({ status: 'ok', photo });
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await takePhoto();
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

    await takePhoto();
    await fireEvent.changeText(
      await screen.findByLabelText('Anything we should know?'),
      '  homemade, no chili ',
    );
    await press('Check this meal');

    await screen.findByText('Mint is a common trigger.');
    expect(analyze).toHaveBeenCalledWith(
      { photo: { uri: photo.uri, mimeType: 'image/jpeg' }, details: 'homemade, no chili' },
      expect.any(AbortSignal),
    );
  });
});

describe('Food screen (updating the verdict with a comment)', () => {
  const photo = { uri: 'file:///cache/prepared.jpg', width: 1024, height: 768 };
  const corrected = {
    ...result,
    mealName: 'Pumpkin soup',
    overall: { verdict: 'ok', confidence: 'high', reasoning: 'Plain pumpkin soup.' },
  };

  const analyzeSoup = async () => {
    await render(<LogFoodScreen />);
    await type('soup');
    await press('Check this meal');
    await screen.findByText('Mint is a common trigger.');
  };

  it('saves the verdict on screen without another call when there is no comment', async () => {
    analyze.mockResolvedValue(result);
    await analyzeSoup();
    await ateThis();

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)[0]).toMatchObject({ mealName: 'Mint tea' });
  });

  it('sends no portion with the check or the update (it is chosen on the details)', async () => {
    analyze.mockResolvedValueOnce(result).mockResolvedValueOnce(corrected);
    await render(<LogFoodScreen />);

    await type('soup');
    expect(screen.queryByRole('button', { name: 'Portion, Regular' })).toBeNull();
    await press('Check this meal');

    expect(await screen.findByText('Mint is a common trigger.')).toBeTruthy();
    expect(analyze).toHaveBeenCalledWith({ text: 'soup' }, expect.any(AbortSignal));

    await tellUs('pumpkin');
    await press('Update verdict');
    await screen.findByText('Plain pumpkin soup.');
    expect(analyze).toHaveBeenLastCalledWith({ text: 'soup', details: 'pumpkin' });
  });

  it('keeps the portion chosen on the details on the diary meal, so History can show and edit it', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);

    await type('soup');
    await press('Check this meal');
    await screen.findByText('Mint is a common trigger.');
    await press('I ate this');
    await fireEvent.press(screen.getByRole('button', { name: 'Portion, Regular' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Small' }));
    await press('Save');

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)[0]).toMatchObject({ portion: 'small' });
  });

  it('only lets "Update verdict" go once there is a comment', async () => {
    analyze.mockResolvedValue(result);
    await analyzeSoup();

    await press('Not quite right? Tell us more');
    expect(screen.getByRole('button', { name: 'Update verdict' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Tell us more'), '   ');
    expect(screen.getByRole('button', { name: 'Update verdict' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Tell us more'), 'pumpkin');
    expect(screen.getByRole('button', { name: 'Update verdict' })).toBeEnabled();
  });

  it('shows the updated verdict before saving, then saves it with no further call', async () => {
    analyze.mockResolvedValueOnce(result).mockResolvedValueOnce(corrected);
    await analyzeSoup();

    await tellUs(" it's pumpkin, no cream ");
    await press('Update verdict');

    expect(await screen.findByText('Plain pumpkin soup.')).toBeTruthy();
    expect(analyze).toHaveBeenLastCalledWith({ text: 'soup', details: "it's pumpkin, no cream" });
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
    await takePhoto();
    await fireEvent.changeText(await screen.findByLabelText('Anything we should know?'), 'homemade');
    await press('Check this meal');
    await screen.findByText('Mint is a common trigger.');

    await tellUs('it is pumpkin soup');
    await press('Update verdict');
    await screen.findByText('Plain pumpkin soup.');
    await tellUs('no cream');
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
    await tellUs('pumpkin');
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
    await tellUs('pumpkin');
    await press('Update verdict');

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(friendlyMessages.RATE_LIMITED));
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByText('Mint is a common trigger.')).toBeTruthy();
    await press('Not quite right? Tell us more');
    expect(screen.getByLabelText('Tell us more').props.value).toBe('pumpkin');
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
    await takePhoto();
    await screen.findByLabelText('Anything we should know?');
    expect(screen.queryByRole('button', { name: 'Save without a verdict' })).toBeNull();
    await press('Check this meal');
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
    expect(screen.queryByText('What did you eat?')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Describe it'), '  Banana bread ');
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
    expect(screen.getByLabelText('Describe it').props.value).toBe('My tea');
    expect(screen.queryByRole('button', { name: 'Save without a verdict' })).toBeNull();
    await press('Check this meal');
    await screen.findByText('Mint is a common trigger.');
    await press('Save to My foods');

    expect(listSavedFoods(mockDb)).toMatchObject([{ id, mealName: 'My tea', overallVerdict: 'caution' }]);
    expect(mockToast).toHaveBeenCalledWith('Updated My tea in My foods');
  });
});

describe('Log food screen: when it was eaten (details)', () => {
  /** Yesterday at 8:15 AM, local time: always in the past whenever the test runs. */
  const yesterdayBreakfast = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 8, 15);
  };
  const turnWheel = async (date: Date) => act(() => mockWheel?.onValueChange({}, date));
  const timePill = () => screen.getByRole('button', { name: /^(Today|Yesterday|[A-Z][a-z]{2} \d)/ });
  /** Opens the wheel from the time pill, turns it to `date`, and confirms. */
  const setTime = async (date: Date) => {
    await fireEvent.press(timePill());
    await turnWheel(date);
    await press('Done');
  };
  const checkMintTea = async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');
    await screen.findByText('Mint is a common trigger.');
  };

  beforeEach(() => {
    mockWheel = null;
  });

  it('has no time picker up front or on the verdict', async () => {
    await render(<LogFoodScreen />);
    expect(screen.queryByText('When did you eat this?')).toBeNull();
    analyze.mockResolvedValue(result);
    await type('mint tea');
    await press('Check this meal');
    await screen.findByText('Mint is a common trigger.');
    expect(screen.queryByText('When did you eat this?')).toBeNull();
  });

  it('shows the time on the details, with a wheel limited to the past week', async () => {
    await checkMintTea();
    await press('I ate this');

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    await fireEvent.press(timePill());
    expect(screen.getByText('When did you eat this?')).toBeTruthy();
    const now = new Date();
    expect(mockWheel?.maximumDate.getTime()).toBeLessThanOrEqual(Date.now());
    expect(mockWheel?.minimumDate).toEqual(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  });

  it('saves at the chosen time', async () => {
    await checkMintTea();
    await press('I ate this');
    await setTime(yesterdayBreakfast());
    await press('Save');

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(meal.loggedAt).toBe(yesterdayBreakfast().toISOString());
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('saves as eaten right now when the time is left alone', async () => {
    await checkMintTea();
    const before = Date.now();
    await ateThis();

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(new Date(meal.loggedAt).getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(new Date(meal.loggedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('saves nothing if the time sheet is dismissed, and back returns to the verdict', async () => {
    await checkMintTea();
    await press('I ate this');
    await fireEvent.press(timePill());
    await fireEvent.press(screen.getByLabelText('Close', { includeHiddenElements: true }));
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);

    await press('Back');

    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'I ate this' })).toBeTruthy();
  });

  it('asks too for "Save without a verdict", and saves at the chosen time', async () => {
    await render(<LogFoodScreen />);
    await type('toast and eggs');

    await press('Save without a verdict');
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    await setTime(yesterdayBreakfast());
    await press('Save');

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(meal.mealName).toBe('toast and eggs');
    expect(meal.loggedAt).toBe(yesterdayBreakfast().toISOString());
  });

  it('never saves a time that has not happened yet', async () => {
    await render(<LogFoodScreen />);
    await type('toast');
    await press('Save without a verdict');
    await setTime(new Date(Date.now() + 60 * 60 * 1000));
    await press('Save');

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(new Date(meal.loggedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });
});
