import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';

import PrepDayScreen from '@/app/prep-day';
import ShoppingListScreen from '@/app/shopping-list';
import { DEFAULT_PLAN_CHOICES } from '@/constants/mealPlan';
import { createTestDb } from '@/db/__tests__/testDb';
import { replaceFridge } from '@/db/repositories/fridgeItems';
import { createPlan, getCurrentPlan } from '@/db/repositories/mealPlans';
import { getPlanChecks } from '@/db/repositories/planChecks';
import { getSetting } from '@/db/repositories/settings';
import { fridgeItems } from '@/db/schema';
import type { AppDb } from '@/db/types';
import { todayKey } from '@/lib/kitchen';
import { addDays } from '@/lib/localDay';
import { cancelPrepReminder, schedulePrepReminder } from '@/services/reminders';
import type { PlanDish } from '@/types/mealPlan';

let mockDb: AppDb;
let closeDb: () => void;
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => ({ settings: {}, reload: jest.fn(), update: jest.fn() }),
}));
jest.mock('@/services/reminders', () => ({
  schedulePrepReminder: jest.fn(),
  cancelPrepReminder: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
jest.mock('@/components/BottomSheet', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { View } = require('react-native');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    BottomSheet: ({ visible, children }: { visible: boolean; children: unknown }) =>
      visible ? <View>{children}</View> : null,
  };
});
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, [effect]),
  router: {
    push: (href: unknown) => mockPush(href),
    back: () => mockBack(),
    replace: jest.fn(),
    canGoBack: () => true,
  },
}));

const schedule = schedulePrepReminder as jest.Mock;

const dish = (id: string, title: string, over: Partial<PlanDish> = {}): PlanDish => ({
  id,
  title,
  minutes: 40,
  serves: 2,
  why: 'Gentle.',
  tip: '',
  keepsDays: 3,
  ingredients: ['2 cups rice', '4 carrots', '1 lb chicken thighs'],
  steps: ['Cook the rice.', 'Roast the carrots.'],
  ...over,
});

const today = todayKey();
const firstMeal = addDays(today, 3);

function savedPlan(mode: 'once' | 'daily' = 'once') {
  return createPlan(mockDb, {
    weekStart: today,
    choices: { ...DEFAULT_PLAN_CHOICES, mode },
    meals: [
      { day: firstMeal, slot: 'lunch', dish: dish('a', 'Chicken bowls') },
      { day: addDays(firstMeal, 1), slot: 'lunch', dish: dish('a', 'Chicken bowls') },
      {
        day: addDays(firstMeal, 4),
        slot: 'dinner',
        dish: dish('b', 'Congee', { keepsDays: 1, steps: ['Simmer the base.'] }),
      },
    ],
  });
}

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockPush.mockClear();
  mockBack.mockClear();
  schedule.mockReset();
  (cancelPrepReminder as jest.Mock).mockClear();
});
afterEach(() => closeDb());

describe('Prep day', () => {
  it('lists the steps with their dish, the storing advice and the reminder switch', async () => {
    savedPlan();
    await render(<PrepDayScreen />);

    expect(screen.getByText('2 dishes, about 2 hours')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Cook the rice., Chicken bowls' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Simmer the base., Congee' })).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: 'Cool everything, then pack and label, All dishes' }),
    ).toBeTruthy();
    expect(screen.getByText('Storing it')).toBeTruthy();
    expect(screen.getByText('Fridge: Chicken bowls.')).toBeTruthy();
    expect(screen.getByText('Freezer: Congee.')).toBeTruthy();
    expect(screen.getByText('At 10:00 am')).toBeTruthy();
  });

  it('ticks a step and keeps it ticked', async () => {
    const plan = savedPlan();
    await render(<PrepDayScreen />);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Cook the rice., Chicken bowls' }));

    expect(
      screen.getByRole('checkbox', { name: 'Cook the rice., Chicken bowls' }).props.accessibilityState
        .checked,
    ).toBe(true);
    expect([...getPlanChecks(mockDb, plan.id).prep]).toEqual(['a:0']);
  });

  it('sets the reminder for the day before the first meal and remembers the plan', async () => {
    const plan = savedPlan();
    schedule.mockResolvedValue('scheduled');
    await render(<PrepDayScreen />);

    await fireEvent.press(screen.getByRole('switch', { name: /^Remind me on / }));

    await waitFor(() => expect(getSetting(mockDb, 'prepReminderPlan')).toBe(plan.id));
    expect(schedule).toHaveBeenCalledWith(addDays(firstMeal, -1));
  });

  it('says so, and stays off, when notifications are not allowed', async () => {
    savedPlan();
    schedule.mockResolvedValue('denied');
    await render(<PrepDayScreen />);

    await fireEvent.press(screen.getByRole('switch', { name: /^Remind me on / }));

    expect(await screen.findByText(/Allow notifications/)).toBeTruthy();
    expect(getSetting(mockDb, 'prepReminderPlan')).toBeNull();
  });

  it('has nothing to prep when the plan cooks every day', async () => {
    savedPlan('daily');
    await render(<PrepDayScreen />);

    expect(screen.getByText(/nothing to prep/)).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});

describe('Shopping list', () => {
  it('shows what is missing by aisle, and what is already at home', async () => {
    savedPlan();
    replaceFridge(mockDb, ['Carrots']);
    await render(<ShoppingListScreen />);

    // Chicken bowls feed two meals of two portions, Congee one: one batch each.
    expect(screen.getByText('2 to buy, 1 you already have')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Protein' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Pantry' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Chicken thighs' })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Carrots' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: /^You already have/ }));
    expect(screen.getAllByText('Carrots').length).toBeGreaterThan(0);
  });

  it('ticks an item and keeps it ticked', async () => {
    const plan = savedPlan();
    await render(<ShoppingListScreen />);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Rice' }));

    expect([...getPlanChecks(mockDb, plan.id).shop]).toEqual(['rice']);
  });

  it('adds an item by hand', async () => {
    const plan = savedPlan();
    await render(<ShoppingListScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Add an item' }));
    const field = screen.getByPlaceholderText('Add an item');
    await fireEvent.changeText(field, 'Dish soap');
    await fireEvent(field, 'submitEditing');

    expect(screen.getByRole('checkbox', { name: 'Dish soap' })).toBeTruthy();
    expect(getPlanChecks(mockDb, plan.id).own).toEqual(['Dish soap']);
  });

  it('shares the list as text, without what is ticked', async () => {
    savedPlan();
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await render(<ShoppingListScreen />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Rice' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Share list' }));

    const message = (share.mock.calls[0]![0] as { message: string }).message;
    expect(message).toContain('Chicken thighs');
    expect(message).not.toContain('Rice');
    share.mockRestore();
  });

  it('asks to scan the fridge again when the scan is old', async () => {
    savedPlan();
    replaceFridge(mockDb, ['Carrots']);
    const old = new Date(Date.now() - 10 * 86_400_000).toISOString();
    mockDb.update(fridgeItems).set({ createdAt: old }).run();
    await render(<ShoppingListScreen />);

    await fireEvent.press(screen.getByRole('button', { name: /Scan it again/ }));
    expect(mockPush).toHaveBeenCalledWith('/fridge');
  });

  it('says there is no plan when there is none', async () => {
    await render(<ShoppingListScreen />);
    expect(getCurrentPlan(mockDb)).toBeNull();
    expect(screen.getByText('There is no plan yet. Make one from the Kitchen.')).toBeTruthy();
  });
});
