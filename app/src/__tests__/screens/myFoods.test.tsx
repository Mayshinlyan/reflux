import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import MyFoodsScreen from '@/app/log/my-foods';
import { createTestDb } from '@/db/__tests__/testDb';
import { listDiaryFoodLogs } from '@/db/repositories/food';
import { createSavedFood, listSavedFoods } from '@/db/repositories/savedFoods';
import type { AppDb } from '@/db/types';

let mockDb: AppDb;
let closeDb: () => void;
const mockToast = jest.fn();

jest.mock('@/db/DatabaseProvider', () => ({ useDb: () => mockDb }));
// Sentry's SDK starts a cleanup timer on import; not needed here.
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('@/components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
  useFocusEffect: (effect: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, [effect]);
  },
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));

const ALL_TIME = { from: '2000-01-01T00:00:00.000Z', to: '2100-01-01T00:00:00.000Z' };
const press = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const pressAlertButton = (spy: jest.SpyInstance, text: string) => {
  const buttons = spy.mock.calls.at(-1)?.[2] as AlertButton[];
  buttons.find((button) => button.text === text)?.onPress?.();
};

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockToast.mockClear();
});
afterEach(() => {
  jest.useRealTimers();
  closeDb();
});

describe('My foods', () => {
  it('explains how to add foods when the list is empty', async () => {
    await render(<MyFoodsScreen />);
    expect(screen.getByText(/Add the foods you eat often/)).toBeTruthy();
  });

  it('logs a saved food in one tap, confirms on the row, and ignores a double-tap', async () => {
    jest.useFakeTimers();
    createSavedFood(mockDb, 'Oatmeal');
    await render(<MyFoodsScreen />);

    await press('Log Oatmeal');
    await press('Oatmeal logged');

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(1);
    expect(mockToast).toHaveBeenCalledWith('Oatmeal logged');
    expect(screen.getByText('Logged ✓')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByRole('button', { name: 'Log Oatmeal' })).toBeTruthy();
  });

  it('adds a food by name', async () => {
    await render(<MyFoodsScreen />);

    await press('+ Add a food');
    await fireEvent.changeText(screen.getByLabelText('Name'), '  Banana bread ');
    await press('Save');

    expect(listSavedFoods(mockDb).map((food) => food.mealName)).toEqual(['Banana bread']);
    expect(screen.getByRole('button', { name: 'Log Banana bread' })).toBeTruthy();
  });

  it("won't save a blank name", async () => {
    await render(<MyFoodsScreen />);
    await press('+ Add a food');
    await fireEvent.changeText(screen.getByLabelText('Name'), '   ');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('renames a food', async () => {
    createSavedFood(mockDb, 'Oatmeal');
    await render(<MyFoodsScreen />);

    await press('Edit Oatmeal');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Porridge');
    await press('Save');

    expect(listSavedFoods(mockDb).map((food) => food.mealName)).toEqual(['Porridge']);
  });

  it('removes a food after confirming, and leaves past meals alone', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    createSavedFood(mockDb, 'Oatmeal');
    await render(<MyFoodsScreen />);
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
    await render(<MyFoodsScreen />);

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
    await render(<MyFoodsScreen />);

    await press('Delete Oatmeal');
    await act(async () => pressAlertButton(alert, 'Cancel'));

    expect(listSavedFoods(mockDb)).toHaveLength(1);
    alert.mockRestore();
  });

  it('offers Delete to screen readers, which cannot swipe', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    createSavedFood(mockDb, 'Oatmeal');
    await render(<MyFoodsScreen />);

    await fireEvent(screen.getByRole('button', { name: 'Edit Oatmeal' }), 'accessibilityAction', {
      nativeEvent: { actionName: 'delete' },
    });
    await act(async () => pressAlertButton(alert, 'Remove'));

    expect(listSavedFoods(mockDb)).toHaveLength(0);
    alert.mockRestore();
  });
});
