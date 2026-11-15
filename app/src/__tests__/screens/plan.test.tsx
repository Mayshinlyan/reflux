import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import PlanScreen from '@/app/plan';
import { DEFAULT_PLAN_CHOICES } from '@/constants/mealPlan';
import { createTestDb } from '@/db/__tests__/testDb';
import { createAvoidFood } from '@/db/repositories/avoidFoods';
import { createPlan, getCurrentPlan, setMealLocked, setMealSkipped } from '@/db/repositories/mealPlans';
import { setSetting } from '@/db/repositories/settings';
import type { AppDb } from '@/db/types';
import { AppError } from '@/lib/errors';
import { todayKey } from '@/lib/kitchen';
import { planSlots, planWeekStart } from '@/lib/mealPlan';
import { getRecipeDraft, setRecipeDraft } from '@/lib/recipeDraft';
import { fetchMealPlan, fetchRecipeIdeas } from '@/services/relayClient';
import type { MealPlanRequest, PlanDish } from '@/types/mealPlan';
import type { Recipe } from '@/types/recipe';

let mockDb: AppDb;
let closeDb: () => void;
let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => ({ settings: {}, reload: jest.fn(), update: jest.fn() }),
}));
jest.mock('@/services/relayClient', () => ({ fetchMealPlan: jest.fn(), fetchRecipeIdeas: jest.fn() }));
// Sentry's SDK starts a cleanup timer on import; not needed here.
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
  const { Pressable, View } = require('react-native');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    BottomSheet: ({
      visible,
      onClose,
      children,
    }: {
      visible: boolean;
      onClose: () => void;
      children: unknown;
    }) =>
      visible ? (
        <View>
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss sheet" onPress={onClose} />
          {children}
        </View>
      ) : null,
  };
});
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-router', () => ({
  router: {
    push: (href: unknown) => mockPush(href),
    back: () => mockBack(),
    replace: jest.fn(),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, [effect]),
}));
jest.mock('@/services/reminders', () => ({ cancelPrepReminder: jest.fn(() => Promise.resolve()) }));

const planFetch = fetchMealPlan as jest.Mock;
const ideasFetch = fetchRecipeIdeas as jest.Mock;

const recipe = (title: string): Recipe => ({
  title,
  minutes: 30,
  serves: 2,
  why: `${title} is soft and mild.`,
  tip: '',
  ingredients: ['1 cup rice', '2 eggs'],
  steps: ['Cook the rice.', 'Add the eggs.'],
});
const dish = (id: string, title: string, keepsDays = 3): PlanDish => ({ ...recipe(title), id, keepsDays });

const today = todayKey();
const press = async (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));

/** A plan answer that puts one dish on every meal that was asked for. */
const answerWith = (title: string) => async (request: MealPlanRequest) => ({
  dishes: [dish('d1', title)],
  meals: request.slots.map((slot) => ({ day: slot.day, slot: slot.slot, dish: 'd1' })),
});

/** A plan that is already saved: today's lunch and dinner. */
function savedPlan() {
  return createPlan(mockDb, {
    weekStart: today,
    choices: DEFAULT_PLAN_CHOICES,
    meals: [
      { day: today, slot: 'lunch', dish: dish('d1', 'Chicken bowls') },
      { day: today, slot: 'dinner', dish: dish('d2', 'Miso salmon', 1) },
    ],
  });
}

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockParams = {};
  mockPush.mockClear();
  mockBack.mockClear();
  planFetch.mockReset();
  ideasFetch.mockReset();
  setRecipeDraft(null);
});
afterEach(() => closeDb());

describe('Plan: making a plan', () => {
  beforeEach(() => {
    mockParams = { make: 'new' };
  });

  it('shows Bellie and the shape of the week while it waits, then the plan', async () => {
    let finish: (value: unknown) => void = () => {};
    planFetch.mockImplementation(
      (request: MealPlanRequest) =>
        new Promise((resolve) => {
          finish = () => resolve(answerWith('Chicken bowls')(request));
        }),
    );
    await render(<PlanScreen />);

    expect(screen.getByText('Planning around what you can eat')).toBeTruthy();
    expect(screen.getByLabelText('Planning your week')).toBeTruthy();

    await waitFor(() => expect(planFetch).toHaveBeenCalledTimes(1));
    finish(undefined);

    expect(await screen.findByRole('header', { name: 'Review the meal plan' })).toBeTruthy();
    expect(screen.queryByText('Planning around what you can eat')).toBeNull();
    expect(screen.getAllByText('Chicken bowls').length).toBeGreaterThan(0);
  });

  it('asks the relay for the chosen meals on the chosen days, with the phone’s own lists', async () => {
    createAvoidFood(mockDb, 'pork');
    setSetting(mockDb, 'conditions', ['acid_reflux']);
    setSetting(mockDb, 'kitchenServes', 3);
    setSetting(mockDb, 'planChoices', { ...DEFAULT_PLAN_CHOICES, cuisines: ['korean'], useFridge: false });
    planFetch.mockImplementation(answerWith('Chicken bowls'));
    await render(<PlanScreen />);

    await screen.findByRole('header', { name: 'Review the meal plan' });
    const expectedSlots = planSlots(
      { weekdays: DEFAULT_PLAN_CHOICES.weekdays, meals: DEFAULT_PLAN_CHOICES.meals },
      planWeekStart(today),
      today,
    );
    expect(planFetch).toHaveBeenCalledTimes(1);
    expect(planFetch.mock.calls[0]![0]).toEqual({
      mode: 'once',
      slots: expectedSlots,
      cuisines: ['korean'],
      prepMinutes: 120,
      serves: 3,
      conditions: ['acid_reflux'],
      avoid: ['pork'],
    });
  });

  it('keeps the plan on the phone, and says how many meals and dishes to prep', async () => {
    planFetch.mockImplementation(answerWith('Chicken bowls'));
    await render(<PlanScreen />);

    await screen.findByRole('header', { name: 'Review the meal plan' });
    const saved = getCurrentPlan(mockDb);
    expect(saved?.meals.length).toBeGreaterThan(0);
    expect(saved?.meals.every((meal) => meal.dish.title === 'Chicken bowls')).toBe(true);
    expect(screen.getByText(`${saved!.meals.length} meals, 1 dish to prep`)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start my week' })).toBeTruthy();
  });

  it('says what went wrong and tries again, keeping no half plan', async () => {
    planFetch
      .mockRejectedValueOnce(new AppError('AI_TIMEOUT'))
      .mockImplementationOnce(answerWith('Chicken bowls'));
    await render(<PlanScreen />);

    expect(await screen.findByText('That took longer than expected. Try again in a moment.')).toBeTruthy();
    expect(getCurrentPlan(mockDb)).toBeNull();

    await press('Try again');

    expect(await screen.findByRole('header', { name: 'Review the meal plan' })).toBeTruthy();
    expect(planFetch).toHaveBeenCalledTimes(2);
  });

  it('refuses an answer that leaves a meal out, instead of keeping a plan with a hole in it', async () => {
    planFetch.mockImplementation(async (request: MealPlanRequest) => ({
      dishes: [dish('d1', 'Chicken bowls')],
      meals: request.slots.slice(1).map((slot) => ({ day: slot.day, slot: slot.slot, dish: 'd1' })),
    }));
    await render(<PlanScreen />);

    expect(await screen.findByText('Something went wrong. Try again in a moment.')).toBeTruthy();
    expect(getCurrentPlan(mockDb)).toBeNull();
  });
});

describe('Plan: the review', () => {
  it('shows the plan without asking the relay, with the week and the day’s meals', async () => {
    savedPlan();
    await render(<PlanScreen />);

    expect(planFetch).not.toHaveBeenCalled();
    expect(screen.getByRole('header', { name: 'Review the meal plan' })).toBeTruthy();
    expect(screen.getByText('2 meals, 2 dishes to prep')).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(7);
    expect(screen.getByText('Chicken bowls')).toBeTruthy();
    expect(screen.getByText('Miso salmon')).toBeTruthy();
    expect(screen.getByText('Chicken bowls is soft and mild.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
  });

  it('opens the prep day and the shopping list from two rows under the days', async () => {
    savedPlan();
    await render(<PlanScreen />);

    await press(/^Prep day, 2 dishes, about 2 hours/);
    expect(mockPush).toHaveBeenLastCalledWith('/prep-day');
    await press(/^Shopping list, /);
    expect(mockPush).toHaveBeenLastCalledWith('/shopping-list');
  });

  it('has no prep day row when every meal is cooked on its day', async () => {
    createPlan(mockDb, {
      weekStart: today,
      choices: { ...DEFAULT_PLAN_CHOICES, mode: 'daily' },
      meals: [{ day: today, slot: 'dinner', dish: dish('d1', 'Chicken bowls', 0) }],
    });
    await render(<PlanScreen />);

    expect(screen.queryByRole('button', { name: /^Prep day/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Shopping list/ })).toBeTruthy();
  });

  it('locks a meal and unlocks it again', async () => {
    const plan = savedPlan();
    await render(<PlanScreen />);

    const lockButtons = screen.getAllByRole('button', { name: 'Lock' });
    await fireEvent.press(lockButtons[0]!);

    expect(screen.getByRole('button', { name: 'Locked' })).toBeTruthy();
    expect(getCurrentPlan(mockDb)?.meals.find((meal) => meal.id === plan.meals[0]!.id)?.locked).toBe(true);

    await press('Locked');
    expect(screen.queryByRole('button', { name: 'Locked' })).toBeNull();
  });

  it('skips a meal (eating out), dims it, and adds it back', async () => {
    const plan = savedPlan();
    await render(<PlanScreen />);

    await fireEvent.press(screen.getAllByRole('button', { name: 'Skip' })[0]!);

    expect(screen.getByText('Eating out')).toBeTruthy();
    expect(getCurrentPlan(mockDb)?.meals.find((meal) => meal.id === plan.meals[0]!.id)?.skipped).toBe(true);
    expect(screen.getByText('1 meal, 1 dish to prep')).toBeTruthy();

    await press('Add back');
    expect(screen.queryByText('Eating out')).toBeNull();
  });

  it('opens a meal as a recipe, holding its keeping time for the recipe page', async () => {
    savedPlan();
    await render(<PlanScreen />);

    await press('Dinner, Miso salmon');

    expect(mockPush).toHaveBeenCalledWith('/recipe');
    expect(getRecipeDraft()?.recipe.title).toBe('Miso salmon');
    expect(getRecipeDraft()?.prep).toEqual({ keepsDays: 1, mode: 'once' });
  });

  it('starts over: the plan is deleted and the page closes', async () => {
    savedPlan();
    await render(<PlanScreen />);

    await press('Start over');

    expect(getCurrentPlan(mockDb)).toBeNull();
    expect(mockBack).toHaveBeenCalled();
  });

  it('says there is no plan when it is opened with none', async () => {
    await render(<PlanScreen />);

    expect(screen.getByText('There is no plan yet. Make one from the Kitchen.')).toBeTruthy();
  });

  it('goes back from Done', async () => {
    savedPlan();
    await render(<PlanScreen />);

    await press('Done');

    expect(mockBack).toHaveBeenCalled();
  });
});

describe('Plan: redo', () => {
  it('plans again only the meals that are not locked or skipped, around the locked ones', async () => {
    const plan = savedPlan();
    setMealLocked(mockDb, plan.meals[0]!.id, true);
    planFetch.mockImplementation(async (request: MealPlanRequest) => ({
      dishes: [dish('n1', 'Baked cod')],
      meals: request.slots.map((slot) => ({ day: slot.day, slot: slot.slot, dish: 'n1' })),
    }));
    await render(<PlanScreen />);

    await press('Redo the meals that are not locked');

    await waitFor(() => expect(planFetch).toHaveBeenCalledTimes(1));
    const request = planFetch.mock.calls[0]![0] as MealPlanRequest;
    expect(request.keep).toEqual(['Chicken bowls']);
    expect(request.slots.some((slot) => slot.day === today && slot.slot === 'lunch')).toBe(false);
    expect(request.slots).toContainEqual({ day: today, slot: 'dinner' });

    await waitFor(() => expect(screen.getByText('Baked cod')).toBeTruthy());
    expect(screen.getByText('Chicken bowls')).toBeTruthy();
    expect(screen.queryByText('Miso salmon')).toBeNull();
  });

  it('has nothing to redo when every meal is locked or skipped', async () => {
    const plan = savedPlan();
    setMealLocked(mockDb, plan.meals[0]!.id, true);
    setMealSkipped(mockDb, plan.meals[1]!.id, true);
    await render(<PlanScreen />);

    expect(screen.queryByRole('button', { name: 'Redo the meals that are not locked' })).toBeNull();
  });

  it('retries the redo, not a new plan, when a redo started from the review fails', async () => {
    const plan = savedPlan();
    setMealLocked(mockDb, plan.meals[0]!.id, true);
    planFetch
      .mockRejectedValueOnce(new AppError('AI_TIMEOUT'))
      .mockImplementationOnce(answerWith('Baked cod'));
    await render(<PlanScreen />);

    await press('Redo the meals that are not locked');
    expect(await screen.findByText('That took longer than expected. Try again in a moment.')).toBeTruthy();
    await press('Try again');

    await waitFor(() => expect(screen.getByText('Baked cod')).toBeTruthy());
    expect(planFetch).toHaveBeenCalledTimes(2);
    expect((planFetch.mock.calls[1]![0] as MealPlanRequest).keep).toEqual(['Chicken bowls']);
    const current = getCurrentPlan(mockDb);
    expect(current?.id).toBe(plan.id);
    expect(current?.meals.find((meal) => meal.locked)?.dish.title).toBe('Chicken bowls');
  });

  it('keeps the old plan when a redo fails', async () => {
    savedPlan();
    planFetch.mockRejectedValue(new AppError('NETWORK'));
    mockParams = { make: 'redo' };
    await render(<PlanScreen />);

    expect(await screen.findByText('Check your connection and try again.')).toBeTruthy();
    expect(getCurrentPlan(mockDb)?.meals.map((meal) => meal.dish.title)).toEqual([
      'Chicken bowls',
      'Miso salmon',
    ]);
  });
});

describe('Plan: swapping a meal', () => {
  it('lists three other dishes and swaps the meal for the one picked, which stays locked', async () => {
    savedPlan();
    ideasFetch.mockResolvedValue([recipe('Baked cod'), recipe('Chicken congee'), recipe('Tofu stir fry')]);
    await render(<PlanScreen />);

    await fireEvent.press(screen.getAllByRole('button', { name: 'Swap' })[1]!);

    expect(await screen.findByRole('header', { name: /^Swap .* dinner$/ })).toBeTruthy();
    expect(ideasFetch).toHaveBeenCalledTimes(1);
    const request = ideasFetch.mock.calls[0]![0];
    expect(request.shown).toEqual(['Chicken bowls', 'Miso salmon']);
    expect(screen.getByText('Baked cod')).toBeTruthy();
    expect(screen.getByText('Tofu stir fry')).toBeTruthy();

    await press('Use Chicken congee');

    await waitFor(() => expect(screen.queryByRole('header', { name: /^Swap / })).toBeNull());
    const swapped = getCurrentPlan(mockDb)?.meals.find((meal) => meal.slot === 'dinner');
    expect(swapped?.dish.title).toBe('Chicken congee');
    expect(swapped?.locked).toBe(true);
    expect(screen.getByText('Chicken congee')).toBeTruthy();
    expect(screen.queryByText('Miso salmon')).toBeNull();
  });

  it('says it could not find another dish, and tries again', async () => {
    savedPlan();
    ideasFetch.mockRejectedValueOnce(new AppError('NETWORK')).mockResolvedValueOnce([recipe('Baked cod')]);
    await render(<PlanScreen />);

    await fireEvent.press(screen.getAllByRole('button', { name: 'Swap' })[0]!);

    expect(await screen.findByText('Check your connection and try again.')).toBeTruthy();
    await press('Try again');
    expect(await screen.findByText('Baked cod')).toBeTruthy();
    expect(ideasFetch).toHaveBeenCalledTimes(2);
  });

  it('closes without changing the meal', async () => {
    savedPlan();
    ideasFetch.mockResolvedValue([recipe('Baked cod')]);
    await render(<PlanScreen />);

    await fireEvent.press(screen.getAllByRole('button', { name: 'Swap' })[0]!);
    await screen.findByText('Baked cod');
    await press('Close');

    expect(getCurrentPlan(mockDb)?.meals.map((meal) => meal.dish.title)).toEqual([
      'Chicken bowls',
      'Miso salmon',
    ]);
  });
});
