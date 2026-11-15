import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import KitchenScreen from '@/app/(tabs)/kitchen';
import { DEFAULT_PLAN_CHOICES } from '@/constants/mealPlan';
import { createTestDb } from '@/db/__tests__/testDb';
import { createAvoidFood } from '@/db/repositories/avoidFoods';
import { replaceFridge } from '@/db/repositories/fridgeItems';
import { createPlan, setMealSkipped } from '@/db/repositories/mealPlans';
import { saveRecipe } from '@/db/repositories/savedRecipes';
import { getSetting } from '@/db/repositories/settings';
import type { AppDb } from '@/db/types';
import { todayKey } from '@/lib/kitchen';
import { addDays } from '@/lib/localDay';
import { getRecipeDraft, setRecipeDraft } from '@/lib/recipeDraft';
import type { PlanDish } from '@/types/mealPlan';
import type { Recipe } from '@/types/recipe';

let mockDb: AppDb;
let closeDb: () => void;
const mockPush = jest.fn();

// A small stand-in for the real provider's settings hook, backed by the real repository. Like the
// real one, every caller shares the same settings: a save re-renders the screen.
const mockListeners = new Set<() => void>();
jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useEffect, useReducer } = require('react');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const repo = require('@/db/repositories/settings');
    const [, rerender] = useReducer((n: number) => n + 1, 0);
    useEffect(() => {
      mockListeners.add(rerender);
      return () => void mockListeners.delete(rerender);
    }, []);
    return {
      settings: repo.getAllSettings(mockDb),
      reload: () => mockListeners.forEach((listener) => listener()),
      update: (key: string, value: unknown) => {
        repo.setSetting(mockDb, key, value);
        mockListeners.forEach((listener) => listener());
      },
    };
  },
}));
// The Feedback button on this page imports the relay client, which loads Firebase; the Kitchen itself calls nothing.
jest.mock('@/services/relayClient', () => ({ sendFeedback: jest.fn() }));
// Sentry's SDK starts a cleanup timer on import; not needed here.
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// Reanimated's native runtime can't load in Jest; use its mocks (which lack useReducedMotion).
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
// The real sheet is a native Modal, which never reports that it closed; this one does, as the Kitchen waits for it.
jest.mock('@/components/BottomSheet', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { useEffect, useRef } = require('react');
  const { Pressable, View } = require('react-native');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    BottomSheet: ({
      visible,
      onClose,
      onDismissed,
      children,
    }: {
      visible: boolean;
      onClose: () => void;
      onDismissed?: () => void;
      children: unknown;
    }) => {
      const wasVisible = useRef(false);
      useEffect(() => {
        if (wasVisible.current && !visible) onDismissed?.();
        wasVisible.current = visible;
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only a change of `visible` counts
      }, [visible]);
      return visible ? (
        <View>
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss sheet" onPress={onClose} />
          {children}
        </View>
      ) : null;
    },
  };
});
jest.mock('expo-router', () => ({
  router: { push: (href: unknown) => mockPush(href), back: jest.fn(), canGoBack: () => true },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]),
}));

const recipe = (title: string): Recipe => ({
  title,
  minutes: 20,
  serves: 2,
  why: `${title} is soft and mild.`,
  tip: '',
  ingredients: ['1 cup rice', '2 eggs'],
  steps: ['Cook the rice.', 'Add the eggs.'],
});
const dish = (id: string, title: string): PlanDish => ({ ...recipe(title), id, keepsDays: 3 });

const press = async (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
const tick = async (name: string) => fireEvent.press(screen.getByRole('checkbox', { name }));

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockPush.mockClear();
  setRecipeDraft(null);
});
afterEach(() => closeDb());

describe('Kitchen with no plan', () => {
  it('has its title, one Plan your week card with one button, and the saved and fridge rows', async () => {
    await render(<KitchenScreen />);

    expect(screen.getByRole('header', { name: 'Kitchen' })).toBeTruthy();
    expect(screen.getByText('What shall we cook?')).toBeTruthy();
    expect(screen.getByText('Plan your week')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Plan my week' })).toBeTruthy();
    expect(screen.getByText('0 recipes')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'My fridge' })).toBeTruthy();
    // The recipe ideas are gone: planning is the way in.
    expect(screen.queryByText(/AI Ideas/)).toBeNull();
    expect(screen.queryByText('Get ideas')).toBeNull();
  });

  it('counts the saved recipes and opens the list', async () => {
    saveRecipe(mockDb, recipe('Miso salmon bowl'), 'japanese');
    await render(<KitchenScreen />);

    expect(screen.getByText('1 recipe')).toBeTruthy();
    await press('Saved recipes, 1 recipe');

    expect(mockPush).toHaveBeenCalledWith('/saved-recipes');
  });

  it('opens the fridge from its row', async () => {
    await render(<KitchenScreen />);

    await press(/^My fridge, /);

    expect(mockPush).toHaveBeenCalledWith('/fridge');
  });
});

describe('Kitchen: the set-up sheet', () => {
  it('opens on the last choices: every day, lunch and dinner, any cuisine, cook once for two hours', async () => {
    await render(<KitchenScreen />);
    await press('Plan my week');

    expect(screen.getByRole('header', { name: 'Plan your week' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Monday' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Sunday' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Lunch' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Dinner' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Breakfast' }).props.accessibilityState.checked).toBe(false);
    expect(screen.getByRole('button', { name: 'Cuisine, Any' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Cook once' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole('tab', { name: '2 hrs' }).props.accessibilityState.selected).toBe(true);
  });

  it('hides the prep time for cook daily', async () => {
    await render(<KitchenScreen />);
    await press('Plan my week');

    await fireEvent.press(screen.getByRole('tab', { name: 'Cook daily' }));

    expect(screen.queryByText('Prep time')).toBeNull();
    expect(screen.queryByRole('tab', { name: '2 hrs' })).toBeNull();
  });

  it('turns a day off, but never the last one', async () => {
    await render(<KitchenScreen />);
    await press('Plan my week');

    await tick('Friday');
    expect(screen.getByRole('checkbox', { name: 'Friday' }).props.accessibilityState.checked).toBe(false);

    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday', 'Sunday']) await tick(day);
    expect(screen.getByRole('checkbox', { name: 'Sunday' }).props.accessibilityState.checked).toBe(true);
  });

  it('keeps at least one meal', async () => {
    await render(<KitchenScreen />);
    await press('Plan my week');

    await tick('Lunch');
    await tick('Dinner');

    expect(screen.getByRole('checkbox', { name: 'Dinner' }).props.accessibilityState.checked).toBe(true);
  });

  it('picks cuisines from a list: Any stands alone, up to four, and unticking the last falls back to Any', async () => {
    await render(<KitchenScreen />);
    await press('Plan my week');
    await press('Cuisine, Any');

    await tick('Korean');
    expect(screen.getByRole('button', { name: 'Cuisine, Korean' })).toBeTruthy();
    await tick('Thai');
    expect(screen.getByRole('button', { name: 'Cuisine, Korean +1' })).toBeTruthy();
    await tick('Italian');
    await tick('Mexican');
    await tick('Indian'); // a fifth is ignored
    expect(screen.getByRole('button', { name: 'Cuisine, Korean +3' })).toBeTruthy();

    await tick('Any');
    expect(screen.getByRole('button', { name: 'Cuisine, Any' })).toBeTruthy();

    await tick('Korean');
    await tick('Korean');
    expect(screen.getByRole('button', { name: 'Cuisine, Any' })).toBeTruthy();
  });

  it('says what it skips from the Foods to avoid list', async () => {
    createAvoidFood(mockDb, 'peanuts');
    createAvoidFood(mockDb, 'Pork');
    createAvoidFood(mockDb, 'raw onion');
    await render(<KitchenScreen />);
    await press('Plan my week');

    expect(screen.getByText('Skips peanuts, pork and 1 more food to avoid. Gentle on reflux.')).toBeTruthy();
  });

  it('only says it is gentle on reflux when nothing is avoided', async () => {
    await render(<KitchenScreen />);
    await press('Plan my week');

    expect(screen.getByText('Gentle on reflux.')).toBeTruthy();
  });

  it('keeps the choices and opens the plan page once the sheet has closed', async () => {
    await render(<KitchenScreen />);
    await press('Plan my week');
    await tick('Friday');
    await tick('Breakfast');
    await press('Cuisine, Any');
    await tick('Korean');
    await fireEvent.press(screen.getByRole('tab', { name: 'Cook daily' }));

    await press('Make my plan');

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/plan', params: { make: 'new' } }),
    );
    expect(getSetting(mockDb, 'planChoices')).toEqual({
      weekdays: [1, 2, 3, 4, 6, 0],
      meals: ['breakfast', 'lunch', 'dinner'],
      cuisines: ['korean'],
      mode: 'daily',
      prepMinutes: 120,
      useFridge: false,
    });
  });

  it('opens on those choices next time', async () => {
    await render(<KitchenScreen />);
    await press('Plan my week');
    await fireEvent.press(screen.getByRole('tab', { name: 'Cook daily' }));
    await press('Make my plan');
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    await press('Plan my week');

    expect(screen.getByRole('tab', { name: 'Cook daily' }).props.accessibilityState.selected).toBe(true);
  });

  it('asks nothing of the plan page when the sheet is closed without Make my plan', async () => {
    await render(<KitchenScreen />);
    await press('Plan my week');

    await press('Close');

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('turns the fridge switch off and sends that choice', async () => {
    replaceFridge(mockDb, ['eggs', 'rice']);
    await render(<KitchenScreen />);
    await press('Plan my week');

    expect(screen.getByText(/^2 items, updated /)).toBeTruthy();
    await fireEvent.press(screen.getByRole('switch', { name: 'Use my fridge' }));
    await press('Make my plan');

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(getSetting(mockDb, 'planChoices').useFridge).toBe(false);
  });

  it('says "Fridge is empty" with an Add items link instead of a switch, and opens the fridge once closed', async () => {
    await render(<KitchenScreen />);
    await press('Plan my week');

    expect(screen.queryByRole('switch', { name: 'Use my fridge' })).toBeNull();
    await press('Fridge is empty. Add items');

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/fridge'));
    expect(mockPush).not.toHaveBeenCalledWith({ pathname: '/plan', params: { make: 'new' } });
  });
});

describe('Kitchen with a plan for this week', () => {
  const today = todayKey();
  const meals = (day: string) => [
    { day, slot: 'lunch' as const, dish: dish('d1', 'Chicken bowls') },
    { day, slot: 'dinner' as const, dish: dish('d2', 'Miso salmon') },
    { day: addDays(day, 1), slot: 'dinner' as const, dish: dish('d2', 'Miso salmon') },
  ];

  it("shows this week, today's meals, the summary and a way into the plan", async () => {
    createPlan(mockDb, { weekStart: today, choices: DEFAULT_PLAN_CHOICES, meals: meals(today) });
    await render(<KitchenScreen />);

    expect(screen.getByText('This week')).toBeTruthy();
    expect(screen.queryByText('Plan your week')).toBeNull();
    expect(screen.getByRole('button', { name: 'Lunch, Chicken bowls' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dinner, Miso salmon' })).toBeTruthy();
    expect(screen.getByText('3 meals, 2 dishes to prep')).toBeTruthy();

    await press(/^Meal plan, /);
    expect(mockPush).toHaveBeenCalledWith('/plan');
  });

  it('opens a meal as a recipe, with its meal-prep details held for the recipe page', async () => {
    createPlan(mockDb, { weekStart: today, choices: DEFAULT_PLAN_CHOICES, meals: meals(today) });
    await render(<KitchenScreen />);

    await press('Lunch, Chicken bowls');

    expect(mockPush).toHaveBeenCalledWith('/recipe');
    expect(getRecipeDraft()?.recipe.title).toBe('Chicken bowls');
    expect(getRecipeDraft()?.prep).toEqual({ keepsDays: 3, mode: 'once' });
  });

  it('leaves out a meal that is skipped (eating out)', async () => {
    const plan = createPlan(mockDb, { weekStart: today, choices: DEFAULT_PLAN_CHOICES, meals: meals(today) });
    setMealSkipped(mockDb, plan.meals[0]!.id, true);
    await render(<KitchenScreen />);

    expect(screen.queryByRole('button', { name: 'Lunch, Chicken bowls' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Dinner, Miso salmon' })).toBeTruthy();
    expect(screen.getByText('2 meals, 1 dish to prep')).toBeTruthy();
  });

  it('says so when nothing is planned for today', async () => {
    createPlan(mockDb, { weekStart: today, choices: DEFAULT_PLAN_CHOICES, meals: meals(addDays(today, 3)) });
    await render(<KitchenScreen />);

    expect(screen.getByText('Nothing planned today.')).toBeTruthy();
  });

  it('says Next week, with no Today card, for a plan that starts after today', async () => {
    createPlan(mockDb, {
      weekStart: addDays(today, 2),
      choices: DEFAULT_PLAN_CHOICES,
      meals: meals(addDays(today, 2)),
    });
    await render(<KitchenScreen />);

    expect(screen.getByText('Next week')).toBeTruthy();
    expect(screen.queryByText('This week')).toBeNull();
    expect(screen.queryByRole('header', { name: 'Today' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Meal plan, / })).toBeTruthy();
  });

  it('opens Saved and My fridge from the two pills', async () => {
    createPlan(mockDb, { weekStart: today, choices: DEFAULT_PLAN_CHOICES, meals: meals(today) });
    await render(<KitchenScreen />);

    await press('Saved recipes');
    await press('My fridge');

    expect(mockPush).toHaveBeenCalledWith('/saved-recipes');
    expect(mockPush).toHaveBeenCalledWith('/fridge');
  });

  it('asks for a new plan once the plan’s week is over', async () => {
    createPlan(mockDb, {
      weekStart: addDays(today, -7),
      choices: DEFAULT_PLAN_CHOICES,
      meals: meals(addDays(today, -7)),
    });
    await render(<KitchenScreen />);

    expect(screen.getByText('Plan your week')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Plan my week' })).toBeTruthy();
    expect(screen.queryByText('This week')).toBeNull();
  });
});
