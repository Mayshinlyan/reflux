import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';

import PrepDayScreen from '@/app/prep-day';
import ShoppingListScreen from '@/app/shopping-list';
import { DEFAULT_PLAN_CHOICES } from '@/constants/mealPlan';
import { createTestDb } from '@/db/__tests__/testDb';
import { replaceFridge } from '@/db/repositories/fridgeItems';
import { createPlan, getCurrentPlan } from '@/db/repositories/mealPlans';
import { getPlanChecks } from '@/db/repositories/planChecks';
import { getPrepPlan, savePrepPlan } from '@/db/repositories/planPrep';
import { getSetting } from '@/db/repositories/settings';
import { fridgeItems } from '@/db/schema';
import type { AppDb } from '@/db/types';
import { AppError } from '@/lib/errors';
import { todayKey } from '@/lib/kitchen';
import { addDays } from '@/lib/localDay';
import { prepDishes } from '@/lib/prep';
import { prepSignature } from '@/lib/prepPlan';
import { fetchPrepPlan } from '@/services/relayClient';
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
jest.mock('@/services/relayClient', () => ({ fetchPrepPlan: jest.fn() }));
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
const prepFetch = fetchPrepPlan as jest.Mock;

/** What the relay returns for the two dishes of savedPlan: Chicken bowls is d1, Congee d2. */
const lined = {
  start: [{ text: 'Heat the oven to 425 F', feeds: ['d1', 'd2'] }],
  dishes: [
    { dish: 'd1', steps: ['Roast the carrots'] },
    { dish: 'd2', steps: ['Simmer the base'] },
  ],
  finish: [{ text: 'Cool everything, then pack and label', feeds: ['d1', 'd2'] }],
};

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
  prepFetch.mockReset();
  prepFetch.mockResolvedValue(lined);
  (cancelPrepReminder as jest.Mock).mockClear();
});
afterEach(() => closeDb());

describe('Prep day', () => {
  it('lines every dish up at once: shared steps first, then each dish under its title', async () => {
    savedPlan();
    await render(<PrepDayScreen />);

    expect(await screen.findByRole('header', { name: 'Start together' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Prep day' })).toBeTruthy();
    expect(screen.getByText('2 dishes, about 2 hours')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Chicken bowls' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Congee' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Finish together' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Heat the oven to 425 F, Both dishes' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Roast the carrots' })).toBeTruthy();
    expect(screen.getByText('Fridge: Chicken bowls.')).toBeTruthy();
    expect(screen.getByText('Freezer: Congee.')).toBeTruthy();
    expect(screen.getByText('At 10:00 am')).toBeTruthy();

    expect(prepFetch).toHaveBeenCalledTimes(1);
    const sent = prepFetch.mock.calls[0]![0] as { dishes: { id: string; title: string }[] };
    expect(sent.dishes.map((dish) => `${dish.id}:${dish.title}`)).toEqual(['d1:Chicken bowls', 'd2:Congee']);
  });

  it('shows the pot while the steps are lined up the first time', async () => {
    savedPlan();
    let finish: (value: unknown) => void = () => {};
    prepFetch.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await render(<PrepDayScreen />);

    expect(screen.getByText('Bellie is lining up your prep…')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    finish(lined);
    expect(await screen.findByRole('header', { name: 'Start together' })).toBeTruthy();
  });

  it('uses the saved session, so a later visit does not ask again', async () => {
    const plan = savedPlan();
    savePrepPlan(mockDb, plan.id, prepSignature(prepDishes(plan.meals, today)), lined);
    await render(<PrepDayScreen />);

    expect(screen.getByRole('header', { name: 'Start together' })).toBeTruthy();
    expect(prepFetch).not.toHaveBeenCalled();
  });

  it('keeps the session it was given, for the next visit', async () => {
    const plan = savedPlan();
    await render(<PrepDayScreen />);
    await screen.findByRole('header', { name: 'Start together' });

    expect(getPrepPlan(mockDb, plan.id, prepSignature(prepDishes(plan.meals, today)))).toEqual(lined);
  });

  it('lists each dish on its own when the steps cannot be lined up, and Try again asks once more', async () => {
    savedPlan();
    prepFetch.mockRejectedValueOnce(new AppError('AI_TIMEOUT'));
    await render(<PrepDayScreen />);

    expect(await screen.findByText(/each dish is listed on its own/)).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Chicken bowls' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Cook the rice.' })).toBeTruthy();
    expect(screen.queryByRole('header', { name: 'Start together' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Try lining up the steps again' }));
    expect(await screen.findByRole('header', { name: 'Start together' })).toBeTruthy();
    expect(prepFetch).toHaveBeenCalledTimes(2);
  });

  it('refuses an answer that leaves a dish out, and falls back', async () => {
    savedPlan();
    prepFetch.mockResolvedValue({ ...lined, dishes: lined.dishes.slice(0, 1) });
    await render(<PrepDayScreen />);

    expect(await screen.findByText(/each dish is listed on its own/)).toBeTruthy();
  });

  it('does not ask the relay for a single dish', async () => {
    createPlan(mockDb, {
      weekStart: today,
      choices: { ...DEFAULT_PLAN_CHOICES, mode: 'once' },
      meals: [{ day: firstMeal, slot: 'dinner', dish: dish('a', 'Chicken bowls') }],
    });
    await render(<PrepDayScreen />);

    expect(screen.getByRole('header', { name: 'Chicken bowls' })).toBeTruthy();
    expect(prepFetch).not.toHaveBeenCalled();
  });

  it('ticks a step and keeps it ticked', async () => {
    const plan = savedPlan();
    await render(<PrepDayScreen />);

    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Roast the carrots' }));

    expect(screen.getByRole('checkbox', { name: 'Roast the carrots' }).props.accessibilityState.checked).toBe(
      true,
    );
    const ticks = [...getPlanChecks(mockDb, plan.id).prep];
    expect(ticks).toHaveLength(1);
    expect(ticks[0]).toMatch(/:d:a:0$/);
  });

  it('sets the reminder for the day before the first meal and remembers the plan', async () => {
    const plan = savedPlan();
    schedule.mockResolvedValue('scheduled');
    await render(<PrepDayScreen />);

    await fireEvent.press(await screen.findByRole('switch', { name: /^Remind me on / }));

    await waitFor(() => expect(getSetting(mockDb, 'prepReminderPlan')).toBe(plan.id));
    expect(schedule).toHaveBeenCalledWith(addDays(firstMeal, -1));
  });

  it('says so, and stays off, when notifications are not allowed', async () => {
    savedPlan();
    schedule.mockResolvedValue('denied');
    await render(<PrepDayScreen />);

    await fireEvent.press(await screen.findByRole('switch', { name: /^Remind me on / }));

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
