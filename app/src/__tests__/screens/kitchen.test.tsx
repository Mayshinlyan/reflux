import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

import KitchenScreen from '@/app/(tabs)/kitchen';
import { createTestDb } from '@/db/__tests__/testDb';
import * as avoidFoodsRepo from '@/db/repositories/avoidFoods';
import { createAvoidFood } from '@/db/repositories/avoidFoods';
import { createSavedFood } from '@/db/repositories/savedFoods';
import { replaceFridge } from '@/db/repositories/fridgeItems';
import { saveRecipe } from '@/db/repositories/savedRecipes';
import { getSetting, setSetting } from '@/db/repositories/settings';
import { fridgeItems } from '@/db/schema';
import type { AppDb } from '@/db/types';
import { AppError } from '@/lib/errors';
import { todayKey } from '@/lib/kitchen';
import { getRecipeDraft, setRecipeDraft } from '@/lib/recipeDraft';
import { fetchRecipeIdeas } from '@/services/relayClient';
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
jest.mock('@/services/relayClient', () => ({ fetchRecipeIdeas: jest.fn() }));
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

const fetchIdeas = fetchRecipeIdeas as jest.Mock;

const recipe = (title: string): Recipe => ({
  title,
  minutes: 20,
  serves: 2,
  why: `${title} is soft and mild.`,
  tip: '',
  ingredients: ['1 cup rice', '2 eggs'],
  steps: ['Cook the rice.', 'Add the eggs.'],
});
const ideas = [recipe('Kimchi egg fried rice'), recipe('Tofu soondubu stew'), recipe('Miso salmon bowl')];

/** The sheet's Get ideas button; the card on the page has one with the same name, listed first. */
const sheetGetIdeas = () => screen.getAllByRole('button', { name: 'Get ideas' })[1]!;
const press = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));

/** Opens the sheet and asks for ideas with whatever is chosen. */
async function ask() {
  await fireEvent.press(screen.getByRole('button', { name: 'Get ideas' }));
  await fireEvent.press(sheetGetIdeas());
}

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockPush.mockClear();
  fetchIdeas.mockReset();
  setRecipeDraft(null);
});
afterEach(() => closeDb());

describe('Kitchen', () => {
  it('has its title, a Cook something card and an empty saved list', async () => {
    await render(<KitchenScreen />);

    expect(screen.getByRole('header', { name: 'Kitchen' })).toBeTruthy();
    expect(screen.getByText('What shall we cook?')).toBeTruthy();
    expect(screen.getByText('Cook something')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Get ideas' })).toBeTruthy();
    expect(screen.getByText('Recipes you save will show up here.')).toBeTruthy();
  });

  it('lists saved recipes, and opens one by its id', async () => {
    const saved = saveRecipe(mockDb, recipe('Miso salmon bowl'), 'japanese');
    await render(<KitchenScreen />);

    await press('Miso salmon bowl, 20 min · serves 2');

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/recipe', params: { saved: String(saved.id) } });
  });
});

describe('Kitchen: the choices sheet', () => {
  it('opens on the last choices, with the cuisine as a dropdown', async () => {
    setSetting(mockDb, 'kitchenCuisine', 'thai');
    setSetting(mockDb, 'kitchenTime', '20');
    setSetting(mockDb, 'kitchenServes', 4);
    await render(<KitchenScreen />);
    await press('Get ideas');

    expect(screen.getByText('What are you craving?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cuisine, Thai' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '20 min' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByLabelText('4 servings')).toBeTruthy();
  });

  it('lists the cuisines A to Z with Any first, and picking one closes the list', async () => {
    await render(<KitchenScreen />);
    await press('Get ideas');
    await press('Cuisine, Any');

    const menu = within(screen.getByLabelText('Cuisine'));
    expect(menu.getAllByRole('radio').map((radio) => radio.props.accessibilityLabel)).toEqual([
      'Any',
      'Chinese',
      'Indian',
      'Italian',
      'Japanese',
      'Korean',
      'Mediterranean',
      'Mexican',
      'Thai',
      'Vietnamese',
    ]);

    await fireEvent.press(menu.getByRole('radio', { name: 'Korean' }));

    expect(screen.queryByLabelText('Cuisine')).toBeNull();
    expect(screen.getByRole('button', { name: 'Cuisine, Korean' })).toBeTruthy();
  });

  it('steps the servings between 1 and 6', async () => {
    setSetting(mockDb, 'kitchenServes', 5);
    await render(<KitchenScreen />);
    await press('Get ideas');

    await press('More servings');
    expect(screen.getByLabelText('6 servings')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More servings' })).toBeDisabled();
    for (let i = 0; i < 5; i += 1) await press('Fewer servings');
    expect(screen.getByLabelText('1 servings')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fewer servings' })).toBeDisabled();
  });

  it('says what it skips from the I don’t eat list', async () => {
    for (const name of ['Peanuts', 'Pork', 'Shellfish', 'Raw onion']) createAvoidFood(mockDb, name);
    await render(<KitchenScreen />);
    await press('Get ideas');

    expect(screen.getByText("Skips peanuts, pork and 2 more foods you don't eat.")).toBeTruthy();
  });

  it('says nothing about skipping when the list is empty', async () => {
    await render(<KitchenScreen />);
    await press('Get ideas');

    expect(screen.queryByText(/^Skips/)).toBeNull();
  });
});

describe('Kitchen: getting ideas', () => {
  it('asks the relay with the choices and the phone’s lists, shows three cards, and counts the round', async () => {
    createSavedFood(mockDb, 'Oatmeal with banana');
    createAvoidFood(mockDb, 'Peanuts');
    setSetting(mockDb, 'conditions', ['acid_reflux']);
    fetchIdeas.mockResolvedValue(ideas);
    await render(<KitchenScreen />);
    await press('Get ideas');
    await press('Cuisine, Any');
    await fireEvent.press(screen.getByRole('radio', { name: 'Korean' }));
    await fireEvent.press(screen.getByRole('tab', { name: '20 min' }));
    await fireEvent.changeText(screen.getByLabelText('Ingredients to use'), 'rice, spinach');

    await fireEvent.press(sheetGetIdeas());

    await waitFor(() => expect(screen.getByText('Kimchi egg fried rice')).toBeTruthy());
    expect(fetchIdeas).toHaveBeenCalledTimes(1);
    expect(fetchIdeas.mock.calls[0]?.[0]).toEqual({
      cuisine: 'korean',
      time: '20',
      serves: 2,
      conditions: ['acid_reflux'],
      want: ['rice', 'spinach'],
      favorites: ['Oatmeal with banana'],
      avoid: ['Peanuts'],
    });
    expect(screen.getByText('Korean recipe ideas')).toBeTruthy();
    expect(screen.getByText('Tofu soondubu stew')).toBeTruthy();
    expect(screen.getByText('Miso salmon bowl')).toBeTruthy();
    expect(getSetting(mockDb, 'kitchenRounds')).toEqual({ day: todayKey(), count: 1 });
    // The choices are kept for next time.
    expect(getSetting(mockDb, 'kitchenCuisine')).toBe('korean');
    expect(getSetting(mockDb, 'kitchenTime')).toBe('20');
  });

  it('asks for nothing when the choices sheet is closed without Get ideas', async () => {
    await render(<KitchenScreen />);
    await press('Get ideas');

    await press('Close');

    expect(fetchIdeas).not.toHaveBeenCalled();
    expect(screen.queryByText('Bellie is cooking up ideas…')).toBeNull();
  });

  it('titles the waiting sheet by cuisine, as recipe ideas, and a plain Any as recipe ideas for you', async () => {
    fetchIdeas.mockReturnValue(new Promise(() => {}));
    setSetting(mockDb, 'kitchenCuisine', 'korean');
    await render(<KitchenScreen />);
    await ask();

    expect(screen.getByRole('header', { name: 'Korean recipe ideas' })).toBeTruthy();
  });

  it('titles the sheet "Recipe ideas for you" when the cuisine is Any', async () => {
    fetchIdeas.mockReturnValue(new Promise(() => {}));
    await render(<KitchenScreen />);
    await ask();

    expect(screen.getByRole('header', { name: 'Recipe ideas for you' })).toBeTruthy();
  });

  const artsShown = () =>
    screen
      .getAllByTestId(/^recipe-art-/, { includeHiddenElements: true })
      .map((art) => art.props.testID as string);

  it('gives each of the three ideas its own picture', async () => {
    fetchIdeas.mockResolvedValue(ideas);
    await render(<KitchenScreen />);
    await ask();
    await waitFor(() => expect(screen.getByText('Kimchi egg fried rice')).toBeTruthy());

    const arts = artsShown();

    expect(arts).toHaveLength(3);
    expect(new Set(arts).size).toBe(3);
  });

  it('starts the next round on a different picture, and keeps the three different', async () => {
    fetchIdeas
      .mockResolvedValueOnce(ideas)
      .mockResolvedValueOnce([
        recipe('Chicken congee'),
        recipe('Steamed fish'),
        recipe('Ginger noodle soup'),
      ]);
    await render(<KitchenScreen />);
    await ask();
    await waitFor(() => expect(screen.getByText('Kimchi egg fried rice')).toBeTruthy());
    const first = artsShown();

    await press('Generate more');
    await waitFor(() => expect(screen.getByText('Chicken congee')).toBeTruthy());
    const second = artsShown();

    expect(new Set(second).size).toBe(3);
    expect(second[0]).not.toBe(first[0]);
  });

  it('carries the picture it was shown with to the saved list', async () => {
    saveRecipe(mockDb, { ...recipe('Miso salmon bowl'), look: 4 }, 'japanese');
    await render(<KitchenScreen />);

    expect(screen.getByRole('button', { name: 'Miso salmon bowl, 20 min · serves 2' })).toBeTruthy();
  });

  it('shows the wait with the pot loader and a Stop button', async () => {
    fetchIdeas.mockReturnValue(new Promise(() => {}));
    await render(<KitchenScreen />);
    await ask();

    expect(screen.getByText('Bellie is cooking up ideas…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
  });

  it('stops without an error, and the round does not count', async () => {
    let signal: AbortSignal | undefined;
    fetchIdeas.mockImplementation((_request: unknown, abort?: AbortSignal) => {
      signal = abort;
      return new Promise(() => {});
    });
    await render(<KitchenScreen />);
    await ask();

    await press('Stop');

    expect(signal?.aborted).toBe(true);
    expect(screen.queryByText("Couldn't get ideas")).toBeNull();
    expect(getSetting(mockDb, 'kitchenRounds').count).toBe(0);
  });

  it('fails closed: if the I don’t eat list cannot be read it asks for nothing, and says it could not get ideas', async () => {
    const spy = jest.spyOn(avoidFoodsRepo, 'listAvoidFoods').mockImplementation(() => {
      throw new Error('db down');
    });
    try {
      await render(<KitchenScreen />);
      await ask();

      await waitFor(() => expect(screen.getByText("Couldn't get ideas")).toBeTruthy());
      expect(fetchIdeas).not.toHaveBeenCalled();
      expect(getSetting(mockDb, 'kitchenRounds').count).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('says it could not get ideas, never counts the round, and tries again', async () => {
    setSetting(mockDb, 'kitchenCuisine', 'korean');
    fetchIdeas.mockRejectedValueOnce(new AppError('NETWORK')).mockResolvedValueOnce(ideas);
    await render(<KitchenScreen />);
    await ask();

    await waitFor(() => expect(screen.getByText("Couldn't get ideas")).toBeTruthy());
    // A failed round has no ideas to name, so the sheet is titled plainly, not by the cuisine that was asked for.
    expect(screen.getByRole('header', { name: 'Recipe ideas' })).toBeTruthy();
    expect(screen.queryByText('Korean recipe ideas')).toBeNull();
    expect(screen.getByText(/Check your connection and try again\./)).toBeTruthy();
    // No small print about the day's count, and no second button: Try again is the one thing to do, and the X closes.
    expect(screen.queryByText(/doesn't count/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(getSetting(mockDb, 'kitchenRounds').count).toBe(0);

    await press('Try again');

    await waitFor(() => expect(screen.getByText('Kimchi egg fried rice')).toBeTruthy());
    expect(fetchIdeas).toHaveBeenCalledTimes(2);
    expect(getSetting(mockDb, 'kitchenRounds').count).toBe(1);
  });

  it('asks for more with the dishes already shown, so they are new ones, and counts that round too', async () => {
    fetchIdeas
      .mockResolvedValueOnce(ideas)
      .mockResolvedValueOnce([
        recipe('Chicken congee'),
        recipe('Steamed fish'),
        recipe('Ginger noodle soup'),
      ]);
    await render(<KitchenScreen />);
    await ask();
    await waitFor(() => expect(screen.getByText('Kimchi egg fried rice')).toBeTruthy());

    await press('Generate more');

    await waitFor(() => expect(screen.getByText('Chicken congee')).toBeTruthy());
    expect(fetchIdeas.mock.calls[1]?.[0].shown).toEqual([
      'Kimchi egg fried rice',
      'Tofu soondubu stew',
      'Miso salmon bowl',
    ]);
    expect(getSetting(mockDb, 'kitchenRounds').count).toBe(2);
  });

  it('opens a recipe once the sheet has closed, holding it for the recipe page', async () => {
    fetchIdeas.mockResolvedValue(ideas);
    await render(<KitchenScreen />);
    await ask();
    await waitFor(() => expect(screen.getByText('Kimchi egg fried rice')).toBeTruthy());

    await fireEvent.press(screen.getAllByRole('button', { name: 'Use this recipe' })[1]!);

    expect(getRecipeDraft()?.recipe.title).toBe('Tofu soondubu stew');
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/recipe'));
  });
});

describe('Kitchen: Feedback', () => {
  it('has a Feedback button at the lower right that opens the feedback sheet', async () => {
    await render(<KitchenScreen />);

    expect(screen.queryByRole('header', { name: 'Tell us what you think' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Feedback' }));

    expect(screen.getByRole('header', { name: 'Tell us what you think' })).toBeTruthy();
  });
});

describe('Kitchen: AI Ideas', () => {
  it('has no AI Ideas button before any ideas were made', async () => {
    await render(<KitchenScreen />);

    expect(screen.queryByRole('button', { name: /^AI Ideas/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Get ideas' })).toBeTruthy();
  });

  it('keeps the round after the sheet is closed, and AI Ideas (3) brings the same three back', async () => {
    fetchIdeas.mockResolvedValue(ideas);
    await render(<KitchenScreen />);
    await ask();
    await waitFor(() => expect(screen.getByText('Kimchi egg fried rice')).toBeTruthy());

    await press('Close');
    expect(screen.getByRole('button', { name: 'New ideas' })).toBeTruthy();
    await press('AI Ideas, 3');

    expect(screen.getByText('Kimchi egg fried rice')).toBeTruthy();
    expect(screen.getByText('Tofu soondubu stew')).toBeTruthy();
    expect(screen.getByText('Miso salmon bowl')).toBeTruthy();
    // Looking back asks nothing of the AI and does not count as a round.
    expect(fetchIdeas).toHaveBeenCalledTimes(1);
    expect(getSetting(mockDb, 'kitchenRounds').count).toBe(1);
  });

  it('shows the last round after the app was restarted', async () => {
    setSetting(mockDb, 'kitchenIdeas', { cuisine: 'korean', recipes: ideas });
    await render(<KitchenScreen />);

    await press('AI Ideas, 3');

    expect(screen.getByText('Korean recipe ideas')).toBeTruthy();
    expect(screen.getByText('Miso salmon bowl')).toBeTruthy();
  });

  it('can still ask for more from the ideas it brought back', async () => {
    setSetting(mockDb, 'kitchenIdeas', { cuisine: 'korean', recipes: ideas });
    fetchIdeas.mockResolvedValue([recipe('Chicken congee')]);
    await render(<KitchenScreen />);
    await press('AI Ideas, 3');

    await press('Generate more');

    await waitFor(() => expect(screen.getByText('Chicken congee')).toBeTruthy());
    expect(fetchIdeas.mock.calls[0]?.[0]).toMatchObject({
      cuisine: 'korean',
      shown: ['Kimchi egg fried rice', 'Tofu soondubu stew', 'Miso salmon bowl'],
    });
    expect(getSetting(mockDb, 'kitchenIdeas')?.recipes[0]?.title).toBe('Chicken congee');
  });

  it('does not keep a failed round', async () => {
    fetchIdeas.mockRejectedValue(new AppError('NETWORK'));
    await render(<KitchenScreen />);
    await ask();

    await waitFor(() => expect(screen.getByText("Couldn't get ideas")).toBeTruthy());
    expect(getSetting(mockDb, 'kitchenIdeas')).toBeNull();
  });

  it('is still there when the kitchen is closed for the day', async () => {
    setSetting(mockDb, 'kitchenRounds', { day: todayKey(), count: 10 });
    setSetting(mockDb, 'kitchenIdeas', { cuisine: 'korean', recipes: ideas });
    await render(<KitchenScreen />);

    expect(screen.getByRole('button', { name: 'Back tomorrow' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'AI Ideas, 3' })).toBeEnabled();
  });
});

describe('Kitchen: the daily limit', () => {
  it('closes the kitchen after 10 rounds today, with the button disabled', async () => {
    setSetting(mockDb, 'kitchenRounds', { day: todayKey(), count: 10 });
    await render(<KitchenScreen />);

    expect(screen.getByText('Kitchen is closed')).toBeTruthy();
    expect(screen.getByText('Bellie is back with fresh ideas tomorrow.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back tomorrow' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Get ideas' })).toBeNull();
  });

  it('opens again on a new day', async () => {
    setSetting(mockDb, 'kitchenRounds', { day: '2020-01-01', count: 10 });
    await render(<KitchenScreen />);

    expect(screen.getByText('Cook something')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Get ideas' })).toBeEnabled();
  });

  it('stops offering more once the last round of the day is used', async () => {
    setSetting(mockDb, 'kitchenRounds', { day: todayKey(), count: 9 });
    fetchIdeas.mockResolvedValue(ideas);
    await render(<KitchenScreen />);
    await ask();

    await waitFor(() => expect(screen.getByText('Kimchi egg fried rice')).toBeTruthy());

    expect(screen.queryByRole('button', { name: 'Generate more' })).toBeNull();
    expect(screen.getByText(/That's today's ideas/)).toBeTruthy();
    await act(async () => {});
  });

  it('tells you the kitchen is closed when the relay says the day’s allowance is used', async () => {
    fetchIdeas.mockRejectedValue(new AppError('RATE_LIMITED'));
    await render(<KitchenScreen />);
    await ask();

    await waitFor(() => expect(screen.getByText('Kitchen is closed')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});

describe('Kitchen: My fridge', () => {
  const daysAgoIso = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  it('invites you to add a fridge when there is none, and opens My fridge', async () => {
    await render(<KitchenScreen />);

    expect(screen.getByRole('header', { name: 'My fridge' })).toBeTruthy();
    expect(screen.getByText('Add your fridge')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^My fridge, Add your fridge/ }));

    expect(mockPush).toHaveBeenCalledWith('/fridge');
  });

  it('shows how many things and when it was updated', async () => {
    replaceFridge(mockDb, ['eggs', 'rice', 'kimchi']);
    await render(<KitchenScreen />);

    expect(screen.getByText('3 items')).toBeTruthy();
    expect(screen.getByText('Updated today')).toBeTruthy();
    expect(screen.queryByText('Update your fridge?')).toBeNull();
  });

  it('asks "Update your fridge?" once it is a week old', async () => {
    replaceFridge(mockDb, ['eggs', 'rice']);
    mockDb
      .update(fridgeItems)
      .set({ createdAt: daysAgoIso(9) })
      .run();
    await render(<KitchenScreen />);

    expect(screen.getByText('Update your fridge?')).toBeTruthy();
    expect(screen.queryByText(/^Updated /)).toBeNull();
  });

  it('turns "Use my fridge" off and dimmed in the sheet when the fridge is empty', async () => {
    await render(<KitchenScreen />);
    await press('Get ideas');

    const toggle = screen.getByRole('switch', { name: 'Use my fridge' });
    expect(toggle.props.value).toBe(false);
    expect(toggle.props.disabled).toBe(true);
    expect(screen.getByText('Use my fridge · none yet')).toBeTruthy();
  });

  it('sends the fridge with the request when the switch is on', async () => {
    replaceFridge(mockDb, ['eggs', 'rice']);
    fetchIdeas.mockResolvedValue(ideas);
    await render(<KitchenScreen />);
    await press('Get ideas');

    expect(screen.getByRole('switch', { name: 'Use my fridge' }).props.value).toBe(true);
    await fireEvent.press(sheetGetIdeas());

    await waitFor(() => expect(fetchIdeas).toHaveBeenCalled());
    expect(fetchIdeas.mock.calls[0]?.[0]).toMatchObject({ fridge: ['eggs', 'rice'] });
    await act(async () => {});
  });

  it('leaves the fridge out when the switch is off, and remembers that next time', async () => {
    replaceFridge(mockDb, ['eggs', 'rice']);
    fetchIdeas.mockResolvedValue(ideas);
    await render(<KitchenScreen />);
    await press('Get ideas');
    await fireEvent(screen.getByRole('switch', { name: 'Use my fridge' }), 'valueChange', false);
    await fireEvent.press(sheetGetIdeas());

    await waitFor(() => expect(fetchIdeas).toHaveBeenCalled());
    expect(fetchIdeas.mock.calls[0]?.[0]).not.toHaveProperty('fridge');
    expect(getSetting(mockDb, 'kitchenUseFridge')).toBe(false);
    await act(async () => {});
  });

  it('does not forget a "yes" because the fridge was empty for a while', async () => {
    fetchIdeas.mockResolvedValue(ideas);
    await render(<KitchenScreen />);
    await ask();

    await waitFor(() => expect(fetchIdeas).toHaveBeenCalled());
    expect(getSetting(mockDb, 'kitchenUseFridge')).toBe(true);
    await act(async () => {});
  });
});
