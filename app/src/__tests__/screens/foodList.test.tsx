import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import LogFoodScreen from '@/app/log/food';
import { FoodList } from '@/components/FoodList';
import { createTestDb } from '@/db/__tests__/testDb';
import { listDiaryFoodLogs } from '@/db/repositories/food';
import { createSavedFood, listSavedFoods, saveCheckedFood } from '@/db/repositories/savedFoods';
import type { AppDb } from '@/db/types';
import type { MealAnalysis } from '@/types/analysis';

let mockDb: AppDb;
let closeDb: () => void;
const mockToast = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('@/db/DatabaseProvider', () => ({ useDb: () => mockDb }));
// Sentry's SDK starts a cleanup timer on import; not needed here.
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
// Renders as a plain view that keeps its props, so a test can find an image by its label.
jest.mock('expo-image', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});
const mockAnalyze = jest.fn();
jest.mock('@/services/relayClient', () => ({ analyzeFood: (input: unknown) => mockAnalyze(input) }));
const mockPick = jest.fn();
jest.mock('@/services/photoPicker', () => ({ pickFoodPhoto: (source: unknown) => mockPick(source) }));
jest.mock('@/services/photoStore', () => ({
  savePhoto: (uri: string) => `stored:${uri}`,
  deletePhoto: jest.fn(),
}));
jest.mock('@/components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: (to: unknown) => mockPush(to) },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, [effect]);
  },
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));
// The check flow has its own tests; here it only matters which screen the route shows, and with what.
jest.mock('@/components/FoodFlow', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  return {
    FoodFlow: ({ openCamera }: { openCamera: boolean }) => <Text>{`check flow camera=${openCamera}`}</Text>,
  };
});
// The native wheel can't render here: the stand-in keeps its latest props so a test can "turn" it.
let mockWheel: { onValueChange: (event: unknown, date: Date) => void } | null = null;
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: NonNullable<typeof mockWheel>) => {
    mockWheel = props;
    return null;
  },
  DateTimePickerAndroid: { open: jest.fn() },
}));

const ALL_TIME = { from: '2000-01-01T00:00:00.000Z', to: '2100-01-01T00:00:00.000Z' };
const press = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const pressAlertButton = (spy: jest.SpyInstance, text: string) => {
  const buttons = spy.mock.calls.at(-1)?.[2] as AlertButton[];
  buttons.find((button) => button.text === text)?.onPress?.();
};
/** Yesterday at 8:15 AM, local time: always in the past whenever the test runs. */
const yesterdayBreakfast = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 8, 15);
};
/** Tap Log, turn the wheel to yesterday's breakfast, and confirm. */
const logAtBreakfast = async (name: string) => {
  await press(`Log ${name}`);
  await act(() => mockWheel?.onValueChange({}, yesterdayBreakfast()));
  await press('Log it');
};

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockToast.mockClear();
  mockPush.mockClear();
  mockParams = {};
  mockWheel = null;
  mockAnalyze.mockReset();
  mockPick.mockReset();
});
afterEach(() => {
  jest.useRealTimers();
  closeDb();
});

describe('Food screen: which view', () => {
  it('goes straight to the check when nothing is saved yet', async () => {
    await render(<LogFoodScreen />);
    expect(screen.getByText('check flow camera=false')).toBeTruthy();
  });

  it('shows My foods when some are saved', async () => {
    createSavedFood(mockDb, 'Oatmeal');
    await render(<LogFoodScreen />);
    expect(screen.getByRole('button', { name: 'Log Oatmeal' })).toBeTruthy();
    expect(screen.queryByText(/check flow/)).toBeNull();
  });

  it('opens the check for "Log a new food"', async () => {
    createSavedFood(mockDb, 'Oatmeal');
    mockParams = { check: '1' };
    await render(<LogFoodScreen />);
    expect(screen.getByText('check flow camera=false')).toBeTruthy();
  });

  it('opens the camera for Scan on Today, even with foods saved', async () => {
    createSavedFood(mockDb, 'Oatmeal');
    mockParams = { camera: '1' };
    await render(<LogFoodScreen />);
    expect(screen.getByText('check flow camera=true')).toBeTruthy();
  });
});

describe('Food screen: My foods', () => {
  it('has a "Log food" title and a "Quick Log" heading', async () => {
    createSavedFood(mockDb, 'Oatmeal');
    await render(<FoodList />);
    expect(screen.getByText('Log food')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Quick Log' })).toBeTruthy();
  });

  it('asks when it was eaten before logging, and logs right now when the time is left alone', async () => {
    jest.useFakeTimers();
    createSavedFood(mockDb, 'Oatmeal');
    await render(<FoodList />);

    await press('Log Oatmeal');
    expect(screen.getByText('When did you eat this?')).toBeTruthy();
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    await press('Log it');
    await press('Oatmeal logged');

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(1);
    expect(mockToast).toHaveBeenCalledWith('Oatmeal logged');
    expect(screen.getByText('Logged ✓')).toBeTruthy();
    expect(screen.getByText(/Eaten today/)).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByRole('button', { name: 'Log Oatmeal' })).toBeTruthy();
  });

  it('logs a food at the chosen time, which does not count as eaten today', async () => {
    createSavedFood(mockDb, 'Oatmeal');
    await render(<FoodList />);

    await logAtBreakfast('Oatmeal');

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(meal.loggedAt).toBe(yesterdayBreakfast().toISOString());
    expect(mockToast).toHaveBeenCalledWith('Oatmeal logged for Yesterday, 8:15 AM');
    expect(screen.queryByText(/Eaten today/)).toBeNull();
  });

  it('never logs a time that has not happened yet', async () => {
    createSavedFood(mockDb, 'Oatmeal');
    await render(<FoodList />);

    await press('Log Oatmeal');
    await act(() => mockWheel?.onValueChange({}, new Date(Date.now() + 60 * 60 * 1000)));
    await press('Log it');

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(new Date(meal.loggedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('"Log a new food" opens the check', async () => {
    createSavedFood(mockDb, 'Oatmeal');
    await render(<FoodList />);
    await press('+ Log a new food');
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/log/food', params: { check: '1' } });
  });

  it('opens the food screen to get a verdict for a saved food', async () => {
    const id = createSavedFood(mockDb, 'Oatmeal');
    await render(<FoodList />);

    await press('Edit Oatmeal');
    await press('Get a verdict');

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/log/food',
      params: { myFood: '1', food: String(id) },
    });
  });

  it("shows a food's verdict when it is tapped", async () => {
    const analysis: MealAnalysis = {
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
    };
    saveCheckedFood(mockDb, {
      source: 'text',
      inputText: 'mint tea',
      analysis,
      meta: { model: 'm', promptVersion: 'p', rulesetVersion: 'r' },
    });
    createSavedFood(mockDb, 'Oatmeal');
    await render(<FoodList />);

    await press('Edit Mint tea');
    expect(screen.getByText('Mint is a common trigger.')).toBeTruthy();
    expect(screen.getByText('Peppermint relaxes the valve.')).toBeTruthy();

    await press('Edit Oatmeal');
    expect(screen.getByText('No verdict yet.')).toBeTruthy();
  });

  describe('editing a saved food', () => {
    const meta = { model: 'm', promptVersion: 'p', rulesetVersion: 'r' };
    const tea: MealAnalysis = {
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
    };
    const openTea = async () => {
      saveCheckedFood(mockDb, { source: 'text', inputText: 'mint tea', analysis: tea, meta });
      await render(<FoodList />);
      await press('Edit Mint tea');
      await press('Edit');
    };

    it('shows the verdict first, and the edit fields only after Edit', async () => {
      saveCheckedFood(mockDb, { source: 'text', inputText: 'mint tea', analysis: tea, meta });
      await render(<FoodList />);
      await press('Edit Mint tea');

      expect(screen.getByText('Mint is a common trigger.')).toBeTruthy();
      expect(screen.queryByLabelText('Name')).toBeNull();
      expect(screen.queryByLabelText('Ingredients')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Edit photo' })).toBeNull();
      expect(screen.getByLabelText('No photo yet')).toBeTruthy();

      await press('Edit');
      expect(screen.getByLabelText('Name')).toBeTruthy();
      expect(screen.getByLabelText('Ingredients')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Edit photo' })).toBeTruthy();
    });

    it('Cancel drops the edits and goes back to the verdict', async () => {
      await openTea();
      await fireEvent.changeText(screen.getByLabelText('Name'), 'Tea');
      await press('Cancel');
      expect(screen.queryByLabelText('Name')).toBeNull();

      await press('Edit');
      expect(screen.getByLabelText('Name').props.value).toBe('Mint tea');
    });

    it('keeps ingredients edited after a Check again', async () => {
      const better: MealAnalysis = {
        ...tea,
        items: [{ ...tea.items[0], ingredients: [{ name: 'Honey', matchedCategories: [] }], verdict: 'ok' }],
        overall: { verdict: 'ok', confidence: 'high', reasoning: 'Honey water is gentle.' },
      };
      mockAnalyze.mockResolvedValue({ ...better, meta });
      await openTea();
      await fireEvent.changeText(screen.getByLabelText('Ingredients'), 'Honey');
      await press('Check again');
      await fireEvent.changeText(screen.getByLabelText('Ingredients'), 'Honey, lemon');
      await press('Save');

      const [food] = listSavedFoods(mockDb);
      expect(food.overallVerdict).toBe('ok');
      expect(food.analysis?.items[0].ingredients.map((i) => i.name)).toEqual(['Honey', 'lemon']);
    });
    const checkAgainButton = () => screen.queryByRole('button', { name: 'Check again' });

    it('hides Check again until the ingredients or photo change', async () => {
      await openTea();
      expect(checkAgainButton()).toBeNull();

      await fireEvent.changeText(screen.getByLabelText('Ingredients'), 'Peppermint, honey');
      expect(checkAgainButton()).toBeTruthy();
      await fireEvent.changeText(screen.getByLabelText('Ingredients'), 'Peppermint');
      expect(checkAgainButton()).toBeNull();

      jest.spyOn(Alert, 'alert');
      mockPick.mockResolvedValue({ status: 'ok', photo: { uri: 'file:///new.jpg' } });
      await press('Edit photo');
      await act(async () => pressAlertButton(Alert.alert as unknown as jest.SpyInstance, 'Choose a photo'));
      expect(checkAgainButton()).toBeTruthy();
    });

    const radio = (name: string) => screen.getByRole('radio', { name });
    /** The collapsed dropdown row, named for the verdict it shows. */
    const verdictRow = (current: string) => screen.getByRole('button', { name: `Verdict, ${current}` });
    const openVerdicts = async (current: string) => fireEvent.press(verdictRow(current));

    it('lets you set the verdict by hand in edit mode only, keeping the AI reasoning', async () => {
      saveCheckedFood(mockDb, { source: 'text', inputText: 'mint tea', analysis: tea, meta });
      await render(<FoodList />);
      await press('Edit Mint tea');
      expect(screen.queryByRole('radio', { name: 'OK' })).toBeNull();

      await press('Edit');
      // Collapsed: one row with the current verdict, not a list of all four.
      expect(screen.queryByRole('radio')).toBeNull();
      await openVerdicts('Caution');
      expect(['OK', 'Likely OK', 'Caution', 'Likely trigger'].map((name) => radio(name))).toHaveLength(4);
      expect(radio('Caution').props.accessibilityState).toEqual({ checked: true });

      await fireEvent.press(radio('OK'));
      expect(screen.queryByRole('radio')).toBeNull(); // choosing closes it
      expect(verdictRow('OK')).toBeTruthy();
      expect(screen.getByText('Set by you. The AI said Caution.')).toBeTruthy();
      expect(screen.getByText('Mint is a common trigger.')).toBeTruthy();
      expect(listSavedFoods(mockDb)[0].overallVerdict).toBe('caution'); // not stored until Save

      await press('Save');
      const [food] = listSavedFoods(mockDb);
      expect(food.overallVerdict).toBe('good');
      expect(food.analysis?.overall).toMatchObject({ verdict: 'caution', userVerdict: 'good' });
      expect(screen.getByText('OK')).toBeTruthy(); // the list row
    });

    it("clears the override when the AI's own verdict is chosen again, and on Cancel", async () => {
      await openTea();
      await openVerdicts('Caution');
      await fireEvent.press(radio('OK'));
      await openVerdicts('OK');
      await fireEvent.press(radio('Caution'));
      expect(screen.queryByText(/Set by you/)).toBeNull();

      await openVerdicts('Caution');
      await fireEvent.press(radio('Likely OK'));
      await press('Cancel');
      expect(screen.queryByText(/Set by you/)).toBeNull();
      await press('Edit');
      expect(verdictRow('Caution')).toBeTruthy();
    });

    it('replaces a verdict set by hand when Check again gives a new one', async () => {
      const better: MealAnalysis = {
        ...tea,
        items: [{ ...tea.items[0], ingredients: [{ name: 'Honey', matchedCategories: [] }], verdict: 'ok' }],
        overall: { verdict: 'ok', confidence: 'high', reasoning: 'Honey water is gentle.' },
      };
      mockAnalyze.mockResolvedValue({ ...better, meta });
      await openTea();
      await openVerdicts('Caution');
      await fireEvent.press(radio('OK'));
      await fireEvent.changeText(screen.getByLabelText('Ingredients'), 'Honey');
      await press('Check again');

      expect(mockToast).toHaveBeenCalledWith('Verdict updated, replacing yours. Save to keep it.');
      expect(verdictRow('Likely OK')).toBeTruthy();
      expect(screen.queryByText(/Set by you/)).toBeNull();
      await press('Save');
      const [food] = listSavedFoods(mockDb);
      expect(food.overallVerdict).toBe('ok');
      expect(food.analysis?.overall.userVerdict).toBeUndefined();
    });

    it('does not show Check again for a name change alone', async () => {
      await openTea();
      await fireEvent.changeText(screen.getByLabelText('Name'), 'Tea');
      expect(checkAgainButton()).toBeNull();
    });

    it('saves edited ingredients without a new verdict', async () => {
      await openTea();
      await fireEvent.changeText(screen.getByLabelText('Ingredients'), 'Peppermint, honey');
      await press('Save');

      expect(mockAnalyze).not.toHaveBeenCalled();
      const [food] = listSavedFoods(mockDb);
      expect(food.analysis?.items[0].ingredients.map((i) => i.name)).toEqual(['Peppermint', 'honey']);
      expect(food.overallVerdict).toBe('caution');
    });

    it('checks again with the edited ingredients, then keeps the new verdict on Save', async () => {
      const better: MealAnalysis = {
        ...tea,
        items: [{ ...tea.items[0], ingredients: [{ name: 'Honey', matchedCategories: [] }], verdict: 'ok' }],
        overall: { verdict: 'ok', confidence: 'high', reasoning: 'Honey water is gentle.' },
      };
      mockAnalyze.mockResolvedValue({ ...better, meta });
      await openTea();

      await fireEvent.changeText(screen.getByLabelText('Ingredients'), 'Honey');
      await press('Check again');

      expect(mockAnalyze).toHaveBeenCalledWith({
        text: 'Mint tea',
        details: 'The ingredients are: Honey',
      });
      expect(screen.getByText('Honey water is gentle.')).toBeTruthy();
      expect(checkAgainButton()).toBeNull(); // the verdict now matches what is shown
      expect(listSavedFoods(mockDb)[0].overallVerdict).toBe('caution'); // not stored until Save

      await press('Save');
      expect(listSavedFoods(mockDb)[0]).toMatchObject({ overallVerdict: 'ok', analysis: better });
    });

    it('keeps the edits and says so when checking again fails', async () => {
      mockAnalyze.mockRejectedValue(new Error('boom'));
      await openTea();
      await fireEvent.changeText(screen.getByLabelText('Ingredients'), 'Honey');
      await press('Check again');

      expect(mockToast).toHaveBeenCalled();
      expect(screen.getByLabelText('Ingredients').props.value).toBe('Honey');
      expect(checkAgainButton()).toBeTruthy();
    });
  });

  it('renames a food', async () => {
    createSavedFood(mockDb, 'Oatmeal');
    await render(<FoodList />);

    await press('Edit Oatmeal');
    await press('Edit');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Porridge');
    await press('Save');

    expect(listSavedFoods(mockDb).map((food) => food.mealName)).toEqual(['Porridge']);
  });

  it("won't save a blank name", async () => {
    createSavedFood(mockDb, 'Oatmeal');
    await render(<FoodList />);
    await press('Edit Oatmeal');
    await press('Edit');
    await fireEvent.changeText(screen.getByLabelText('Name'), '   ');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('removes a food after confirming, and leaves past meals alone', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    createSavedFood(mockDb, 'Oatmeal');
    await render(<FoodList />);
    await press('Log Oatmeal');
    await press('Log it');

    await press('Edit Oatmeal');
    await press('Remove from my list');
    expect(listSavedFoods(mockDb)).toHaveLength(1);
    await act(async () => pressAlertButton(alert, 'Remove'));

    expect(listSavedFoods(mockDb)).toHaveLength(0);
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(1);
    alert.mockRestore();
  });

  // The swipeable stub always renders the revealed action, which is what a left swipe shows.
  it('deletes a food from a left swipe, after confirming', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    createSavedFood(mockDb, 'Oatmeal');
    createSavedFood(mockDb, 'Mint tea');
    await render(<FoodList />);

    await press('Delete Oatmeal');
    expect(alert).toHaveBeenLastCalledWith('Remove Oatmeal?', expect.any(String), expect.any(Array));
    await act(async () => pressAlertButton(alert, 'Remove'));

    expect(listSavedFoods(mockDb).map((food) => food.mealName)).toEqual(['Mint tea']);
    expect(screen.queryByText('Oatmeal')).toBeNull();
    alert.mockRestore();
  });

  it('keeps the food when the swipe delete is cancelled', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    createSavedFood(mockDb, 'Oatmeal');
    await render(<FoodList />);

    await press('Delete Oatmeal');
    await act(async () => pressAlertButton(alert, 'Cancel'));

    expect(listSavedFoods(mockDb)).toHaveLength(1);
    alert.mockRestore();
  });

  it('offers Delete to screen readers, which cannot swipe', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    createSavedFood(mockDb, 'Oatmeal');
    await render(<FoodList />);

    await fireEvent(screen.getByRole('button', { name: 'Edit Oatmeal' }), 'accessibilityAction', {
      nativeEvent: { actionName: 'delete' },
    });
    await act(async () => pressAlertButton(alert, 'Remove'));

    expect(listSavedFoods(mockDb)).toHaveLength(0);
    alert.mockRestore();
  });

  it('explains what to do once the last food is removed', async () => {
    await render(<FoodList />);
    expect(screen.getByText(/Add the foods you eat often/)).toBeTruthy();
  });
});
