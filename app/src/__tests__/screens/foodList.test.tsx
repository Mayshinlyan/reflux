import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import LogFoodScreen from '@/app/log/food';
import { FoodList } from '@/components/FoodList';
import { createTestDb } from '@/db/__tests__/testDb';
import { listDiaryFoodLogs } from '@/db/repositories/food';
import { createSavedFood, listSavedFoods } from '@/db/repositories/savedFoods';
import type { AppDb } from '@/db/types';

let mockDb: AppDb;
let closeDb: () => void;
const mockToast = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('@/db/DatabaseProvider', () => ({ useDb: () => mockDb }));
// Sentry's SDK starts a cleanup timer on import; not needed here.
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
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
    FoodFlow: ({ openCamera, initialEatenAt }: { openCamera: boolean; initialEatenAt: Date | null }) => (
      <Text>{`check flow camera=${openCamera} at=${initialEatenAt?.toISOString() ?? 'now'}`}</Text>
    ),
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
const chooseBreakfast = async () => {
  await fireEvent.press(screen.getByRole('button', { name: /^When did you eat this\?/ }));
  await act(() => mockWheel?.onValueChange({}, yesterdayBreakfast()));
  await press('Set time');
};

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockToast.mockClear();
  mockPush.mockClear();
  mockParams = {};
  mockWheel = null;
});
afterEach(() => {
  jest.useRealTimers();
  closeDb();
});

describe('Food screen: which view', () => {
  it('goes straight to the check when nothing is saved yet', async () => {
    await render(<LogFoodScreen />);
    expect(screen.getByText('check flow camera=false at=now')).toBeTruthy();
  });

  it('shows My foods when some are saved', async () => {
    createSavedFood(mockDb, 'Oatmeal');
    await render(<LogFoodScreen />);
    expect(screen.getByRole('button', { name: 'Log Oatmeal' })).toBeTruthy();
    expect(screen.queryByText(/check flow/)).toBeNull();
  });

  it('opens the check for "Check a new food", keeping the chosen time', async () => {
    createSavedFood(mockDb, 'Oatmeal');
    const at = yesterdayBreakfast().toISOString();
    mockParams = { check: '1', at };
    await render(<LogFoodScreen />);
    expect(screen.getByText(`check flow camera=false at=${at}`)).toBeTruthy();
  });

  it('opens the camera for Scan on Today, even with foods saved', async () => {
    createSavedFood(mockDb, 'Oatmeal');
    mockParams = { camera: '1' };
    await render(<LogFoodScreen />);
    expect(screen.getByText('check flow camera=true at=now')).toBeTruthy();
  });

  it('ignores a time that is not a date', async () => {
    mockParams = { check: '1', at: 'soon' };
    await render(<LogFoodScreen />);
    expect(screen.getByText('check flow camera=false at=now')).toBeTruthy();
  });
});

describe('Food screen: My foods', () => {
  it('logs a saved food in one tap, confirms on the row, and ignores a double-tap', async () => {
    jest.useFakeTimers();
    createSavedFood(mockDb, 'Oatmeal');
    await render(<FoodList />);

    await press('Log Oatmeal');
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
    await chooseBreakfast();

    await press('Log Oatmeal');

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(meal.loggedAt).toBe(yesterdayBreakfast().toISOString());
    expect(mockToast).toHaveBeenCalledWith('Oatmeal logged for Yesterday, 8:15 AM');
    expect(screen.queryByText(/Eaten today/)).toBeNull();
  });

  it('"Check a new food" opens the check, passing on the chosen time', async () => {
    createSavedFood(mockDb, 'Oatmeal');
    await render(<FoodList />);
    await press('+ Check a new food');
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/log/food', params: { check: '1' } });

    await chooseBreakfast();
    await press('+ Check a new food');
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/log/food',
      params: { check: '1', at: yesterdayBreakfast().toISOString() },
    });
  });

  it('renames a food', async () => {
    createSavedFood(mockDb, 'Oatmeal');
    await render(<FoodList />);

    await press('Edit Oatmeal');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Porridge');
    await press('Save');

    expect(listSavedFoods(mockDb).map((food) => food.mealName)).toEqual(['Porridge']);
  });

  it("won't save a blank name", async () => {
    createSavedFood(mockDb, 'Oatmeal');
    await render(<FoodList />);
    await press('Edit Oatmeal');
    await fireEvent.changeText(screen.getByLabelText('Name'), '   ');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('removes a food after confirming, and leaves past meals alone', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    createSavedFood(mockDb, 'Oatmeal');
    await render(<FoodList />);
    await press('Log Oatmeal');

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
    expect(screen.getByText(/Check a food, then save it/)).toBeTruthy();
  });
});
