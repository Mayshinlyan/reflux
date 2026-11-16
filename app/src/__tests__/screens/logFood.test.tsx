import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import LogFoodScreen from '@/app/log/food';
import { SwitchKindProvider } from '@/components/LogKindSwitcher';
import { createTestDb } from '@/db/__tests__/testDb';
import { createUncheckedMeal, listDiaryFoodLogs, listMealTags } from '@/db/repositories/food';
import { createSavedFood, listSavedFoods, saveCheckedFood } from '@/db/repositories/savedFoods';
import { createSavedSymptom, listSavedSymptoms } from '@/db/repositories/savedSymptoms';
import { setSetting } from '@/db/repositories/settings';
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
const mockPush = jest.fn();
const mockSetOptions = jest.fn();
const mockToast = jest.fn();
let mockReminderMinutes: number | null = null;
let mockBedtime = '22:30';
let mockParams: {
  photoUri?: string;
  camera?: string;
  myFood?: string;
  food?: string;
  check?: string;
  date?: string;
  quickLog?: string;
  t?: string;
  details?: string;
  prefill?: string;
} = {};

jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => ({
    settings: {
      bedtime: mockBedtime,
      lateMealWindowMinutes: 180,
      checkInReminderMinutes: mockReminderMinutes,
    },
  }),
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
// The real sheet is a native Modal, which never reports that it closed; this one does, as the picker waits for it.
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
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} />
          {children}
        </View>
      ) : null;
    },
  };
});
jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    dismissTo: () => mockBack(),
    push: (...args: unknown[]) => mockPush(...args),
    canGoBack: () => true,
    // The completion now replaces the log page in one step; count it as the leave plus the push the tests expect.
    replace: (...args: unknown[]) => {
      mockBack();
      mockPush(...args);
    },
  },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ setOptions: mockSetOptions }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]),
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
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
/** "Add details" on the completion page opens the check-in on that meal, as its own screen. */
const addDetails = async () => {
  const opened = mockPush.mock.calls.at(-1)?.[0];
  expect(opened).toMatchObject({ pathname: '/completion', params: { kind: 'meal' } });
  mockParams = { details: opened.params.id };
  await screen.unmount();
  await render(<LogFoodScreen />);
};
/** "I ate this" logs it as eaten right now and goes back to Today; the toast's Add details and Done finish it. */
const ateThis = async () => {
  await press('I ate this');
  await addDetails();
  await press('Done');
};
/** The photo card opens a sheet to take a photo or choose one. */
const takePhoto = async () => {
  await press('Take a photo');
};
const choosePhoto = async () => {
  await press('Choose a photo');
};
/** The correction lives in a sheet behind "Not quite right?". */
const tellUs = async (value: string) => {
  await press('Not quite right?');
  await fireEvent.changeText(screen.getByLabelText('Tell us more'), value);
};

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockBack.mockClear();
  mockPush.mockClear();
  mockToast.mockClear();
  mockReminderMinutes = null;
  mockBedtime = '22:30';
  jest.mocked(Notifications.scheduleNotificationAsync).mockClear();
  jest.mocked(Notifications.cancelScheduledNotificationAsync).mockClear();
  mockParams = {};
  analyze.mockReset();
  pick.mockReset();
  store.mockReset().mockReturnValue('file:///doc/photos/meal.jpg');
  removePhoto.mockReset();
});

afterEach(() => closeDb());

describe('Log food screen: Save to favorite foods', () => {
  const checkMintTea = async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');
    await screen.findByRole('header', { name: 'Your belly might not love this.' });
  };

  it('offers favorite foods only on the check-in after the meal is logged, not on the verdict', async () => {
    await checkMintTea();
    expect(screen.queryByRole('checkbox', { name: 'Add to favorite foods' })).toBeNull();

    await press('I ate this');
    await addDetails();

    expect(screen.getByRole('checkbox', { name: 'Add to favorite foods', checked: false })).toBeTruthy();
  });

  it('saves the logged meal to favorite foods too, with its verdict, when starred on the check-in', async () => {
    await checkMintTea();

    await press('I ate this');
    await addDetails();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Add to favorite foods' }));
    await press('Done');

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toMatchObject([{ mealName: 'Mint tea' }]);
    expect(listSavedFoods(mockDb)).toMatchObject([{ mealName: 'Mint tea', overallVerdict: 'caution' }]);
    expect(mockToast).toHaveBeenCalledWith('Added to favorite foods');
  });

  it('keeps a starred favorite even when the check-in is skipped', async () => {
    await checkMintTea();

    await press('I ate this');
    await addDetails();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Add to favorite foods' }));
    await press('Skip for now');

    expect(listSavedFoods(mockDb)).toMatchObject([{ mealName: 'Mint tea' }]);
    expect(mockBack).toHaveBeenCalledTimes(2); // Today after "I ate this", and again on skipping
  });

  it('leaves favorite foods alone when not starred', async () => {
    await checkMintTea();

    await ateThis();

    expect(listSavedFoods(mockDb)).toHaveLength(0);
    expect(mockToast).not.toHaveBeenCalled(); // the completion page, not a toast
  });
});

describe('Log food screen: kind tabs (Figma 48b)', () => {
  const inTypeModal = (
    <SwitchKindProvider onSwitch={jest.fn()}>
      <LogFoodScreen />
    </SwitchKindProvider>
  );

  it('shows Food / How I feel / Medication in the Type modal, with Food selected', async () => {
    mockParams = {};
    await render(inTypeModal);

    expect(screen.getAllByRole('tab').map((el) => el.props.accessibilityState.selected)).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('has no tabs on its own, e.g. from the widget or a link', async () => {
    mockParams = {};
    await render(<LogFoodScreen />);

    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('hides them for a Kitchen recipe and for a favorite food', async () => {
    mockParams = { prefill: 'Kimchi egg fried rice' };
    await render(inTypeModal);
    expect(screen.queryByRole('tab')).toBeNull();
    await screen.unmount();

    mockParams = { myFood: '1' };
    await render(inTypeModal);
    expect(screen.queryByRole('tab')).toBeNull();
  });
});

describe('Log food screen: from a Kitchen recipe (?prefill=)', () => {
  it('starts with the dish typed in, ready to check like any typed meal', async () => {
    mockParams = { prefill: 'Kimchi egg fried rice' };
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);

    expect(screen.getByLabelText('Describe it').props.value).toBe('Kimchi egg fried rice');
    await press('Check this meal');

    expect(analyze.mock.calls[0]?.[0]).toMatchObject({ text: 'Kimchi egg fried rice' });
  });

  it('cuts a very long prefill so a link cannot fill the box', async () => {
    mockParams = { prefill: 'x'.repeat(500) };
    await render(<LogFoodScreen />);

    expect(screen.getByLabelText('Describe it').props.value).toHaveLength(200);
  });

  it('is an empty box with no prefill', async () => {
    mockParams = {};
    await render(<LogFoodScreen />);

    expect(screen.getByLabelText('Describe it').props.value).toBe('');
  });
});

describe('Log food screen: "Add a food" from Favorite foods', () => {
  const typeFood = async (value: string) => fireEvent.changeText(screen.getByLabelText('Describe it'), value);

  beforeEach(() => {
    mockParams = { myFood: '1' };
  });

  it('is headed "Add a favorite food" and says food, not meal', async () => {
    await render(<LogFoodScreen />);
    await typeFood('mint tea');

    expect(screen.getByText('Add a favorite food')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check this food' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Just save it' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Just log it' })).toBeNull();
  });

  it('saves the verdict to favorite foods with one button, and never adds a meal to the diary', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await typeFood('mint tea');
    await press('Check this food');
    await screen.findByRole('header', { name: 'Your belly might not love this.' });

    // One way to save it: no "I ate this", and no second "save only" link.
    expect(screen.queryByRole('button', { name: 'I ate this' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save to favorite foods only' })).toBeNull();
    await press('Save to favorite foods');

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(listSavedFoods(mockDb)).toMatchObject([{ mealName: 'Mint tea', overallVerdict: 'caution' }]);
    expect(mockToast).toHaveBeenCalledWith('Mint tea added to favorite foods');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('"Just save it" adds the typed food by name, with no verdict and no diary meal', async () => {
    await render(<LogFoodScreen />);
    await typeFood('Banana bread');

    await press('Just save it');

    expect(listSavedFoods(mockDb).map((food) => food.mealName)).toEqual(['Banana bread']);
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(analyze).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith('Banana bread added to favorite foods');
  });
});

describe('Log food screen (text)', () => {
  it('can check only once something is typed, and offers saving without a verdict then', async () => {
    await render(<LogFoodScreen />);
    expect(screen.getByRole('button', { name: 'Check this meal' })).toBeDisabled();
    await type('   ');
    expect(screen.getByRole('button', { name: 'Check this meal' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Just log it' })).toBeNull();
    await type('toast');
    expect(screen.getByRole('button', { name: 'Check this meal' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Just log it' })).toBeTruthy();
  });

  it('can be swiped down to close only while nothing is typed, so a stray drag cannot drop a description', async () => {
    const swipeAllowed = () => mockSetOptions.mock.calls.at(-1)?.[0].gestureEnabled;
    await render(<LogFoodScreen />);
    expect(swipeAllowed()).toBe(true);

    await type('toast');
    expect(swipeAllowed()).toBe(false);

    await type('');
    expect(swipeAllowed()).toBe(true);
  });

  it('analyzes the trimmed text, shows the result, and saves it to the diary', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);

    await type('  mint tea ');
    await press('Check this meal');

    expect(await screen.findByRole('header', { name: 'Your belly might not love this.' })).toBeTruthy();
    expect(analyze).toHaveBeenCalledWith({ text: 'mint tea' }, expect.any(AbortSignal));

    await press('I ate this');
    await addDetails();
    await press('Done');

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
    expect(mockToast).not.toHaveBeenCalled(); // the completion page, not a toast
    expect(mockBack).toHaveBeenCalledTimes(2); // Today after "I ate this", and again after the check-in
  });

  it('still logs the meal when its stored check can no longer be promoted', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');
    await screen.findByRole('header', { name: 'Your belly might not love this.' });
    // The check row is gone, so promoting it throws; "I ate this" writes the verdict on screen instead.
    mockDb.delete(foodLogs).run();

    await press('I ate this');

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toMatchObject([
      { mealName: 'Mint tea', entryType: 'diary', overallVerdict: 'caution' },
    ]);
    await addDetails();
    expect(mockToast).not.toHaveBeenCalled(); // the completion page, not a toast
  });

  it('skips the check-in extras with "Skip for now", leaving the meal logged', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');
    await screen.findByRole('header', { name: 'Your belly might not love this.' });
    await press('I ate this');
    await addDetails();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Stress' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Heartburn' }));

    await press('Skip for now');

    const meals = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(meals).toHaveLength(1);
    expect(listMealTags(mockDb, meals[0].id)).toEqual([]);
    expect(listSymptomLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(mockBack).toHaveBeenCalledTimes(2); // Today after "I ate this", and again on skipping
  });

  it('shows the loader instead of the form while the relay works, then the result', async () => {
    let resolve!: (value: unknown) => void;
    analyze.mockReturnValue(new Promise((r) => (resolve = r)));
    await render(<LogFoodScreen />);
    await type('dim sum');
    await press('Check this meal');

    expect(screen.getByText('loading:text')).toBeTruthy();
    expect(screen.queryByLabelText('Describe it')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Take a photo' })).toBeNull();

    await act(async () => resolve(result));
    expect(await screen.findByRole('header', { name: 'Your belly might not love this.' })).toBeTruthy();
    expect(screen.queryByText('loading:text')).toBeNull();
  });

  it('keeps Save on screen outside the scrolling result, however long the meal is', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('dim sum');
    await press('Check this meal');
    await screen.findByRole('header', { name: 'Your belly might not love this.' });

    const insideScroll = (element: { parent: unknown; type: unknown } | null): boolean =>
      element !== null && (element.type === 'RCTScrollView' || insideScroll(element.parent as never));
    const save = screen.getByRole('button', { name: 'I ate this' });
    expect(insideScroll(save)).toBe(false);
    // The card itself does scroll, so the check above is meaningful.
    expect(insideScroll(screen.getByRole('header', { name: 'Your belly might not love this.' }))).toBe(true);
  });

  it('does not log twice on a double tap of "I ate this"', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');
    await screen.findByRole('header', { name: 'Your belly might not love this.' });

    const ate = screen.getByRole('button', { name: 'I ate this' });
    await fireEvent.press(ate);
    await fireEvent.press(ate);

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
    await waitFor(() =>
      expect(screen.getByRole('header', { name: 'Your belly might not love this.' })).toBeTruthy(),
    );
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

    expect(await screen.findByRole('header', { name: 'Your belly might not love this.' })).toBeTruthy();
    expect(screen.getByText('Mint is a common trigger.')).toBeTruthy(); // "Why?" is open
    expect(screen.getByRole('button', { name: 'Why?' }).props.accessibilityState).toMatchObject({
      expanded: true,
    });
    expect(screen.getByLabelText('Mint')).toBeTruthy();
    expect(screen.getByLabelText('Belly feels cautious')).toBeTruthy();
    // The AI's words lead the screen; the food's description no longer does.
    expect(screen.queryByText(/Mint tea ·/)).toBeNull();
  });

  it('leads with the AI summary and a "Better next time" tip when the relay sends them', async () => {
    analyze.mockResolvedValue({
      ...result,
      overall: {
        ...result.overall,
        summary: 'Mint can relax the valve that keeps acid down.',
        tip: 'Try ginger or chamomile tea instead.',
      },
    });
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');

    expect(await screen.findByText('Mint can relax the valve that keeps acid down.')).toBeTruthy();
    expect(screen.getByText('Better next time')).toBeTruthy();
    expect(screen.getByText('Try ginger or chamomile tea instead.')).toBeTruthy();
  });

  it('shows no summary or tip card for a result without them (checked before they existed)', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');

    await screen.findByText('Why?');
    expect(screen.queryByText('Better next time')).toBeNull();
  });

  it('lists the key ingredients in the why card', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');

    await screen.findByText('Why?');
    expect(await screen.findByText(/Key ingredients:\s*Peppermint/)).toBeTruthy();
  });

  it('goes back from the verdict to the typed text without saving anything', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');
    await screen.findByRole('header', { name: 'Your belly might not love this.' });

    await press('Back');

    expect(screen.getByLabelText('Describe it').props.value).toBe('mint tea');
    expect(mockBack).not.toHaveBeenCalled();
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('shows the food as the title with nothing required, and no portion to pick', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');
    await screen.findByRole('header', { name: 'Your belly might not love this.' });

    await press('I ate this');
    await addDetails();

    expect(screen.getByRole('header', { name: 'Mint tea' })).toBeTruthy();
    expect(screen.getByText("How's your belly?")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeTruthy();
    expect(screen.queryByLabelText('Caution')).toBeNull(); // they just saw the verdict
    expect(screen.getByText("What's going on?")).toBeTruthy();
    expect(screen.getByText('Anything bothering you now?')).toBeTruthy();
    expect(screen.getByLabelText('Note')).toBeTruthy();
    expect(screen.queryByText('Portion')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Portion/ })).toBeNull();
  });

  it('saves lifestyle tags, symptoms and the note from the check-in, leaving the portion alone', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');
    await screen.findByRole('header', { name: 'Your belly might not love this.' });

    await press('I ate this');
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(1); // already logged, before any details
    await addDetails();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Stress' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Heartburn' }));
    await fireEvent.changeText(screen.getByLabelText('Note'), '  felt heavy ');
    await press('Done');

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(meal).toMatchObject({ portion: null, notes: 'felt heavy' });
    expect(listMealTags(mockDb, meal.id)).toEqual(['stress']);
    const [symptomLog] = listSymptomLogs(mockDb, ALL_TIME);
    expect(symptomLog).toMatchObject({ foodLogId: meal.id, loggedAt: meal.loggedAt });
    expect(symptomLog.items.map((item) => item.key)).toEqual(['heartburn']);
    expect(mockBack).toHaveBeenCalledTimes(2); // Today after "I ate this", and again after the check-in
  });

  describe('the check-in reminder', () => {
    /** A bedtime 12 hours from now, so the reminder never lands in the quiet hours whatever time the test runs. */
    const bedtimeFarFromNow = () => {
      const later = new Date(Date.now() + 12 * 3_600_000);
      return `${String(later.getHours()).padStart(2, '0')}:${String(later.getMinutes()).padStart(2, '0')}`;
    };
    const logMint = async () => {
      analyze.mockResolvedValue(result);
      await render(<LogFoodScreen />);
      await type('mint tea');
      await press('Check this meal');
      await screen.findByRole('header', { name: 'Your belly might not love this.' });
      await press('I ate this');
      const meal = listDiaryFoodLogs(mockDb, ALL_TIME)[0];
      await addDetails();
      return meal;
    };

    it('is scheduled for the meal when the reminder is on', async () => {
      mockReminderMinutes = 120;
      mockBedtime = bedtimeFarFromNow();

      const meal = await logMint();

      await waitFor(() => expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1));
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: `meal-${meal.id}`,
          content: expect.objectContaining({
            body: 'You had Mint tea about 2 hours ago. Tap to check in.',
            data: { foodLogId: meal.id },
          }),
        }),
      );
    });

    it('is not scheduled when the reminder is off', async () => {
      mockBedtime = bedtimeFarFromNow();

      await logMint();
      await act(async () => {});

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('is dropped when the check-in adds a symptom, because they just checked in', async () => {
      mockReminderMinutes = 120;
      mockBedtime = bedtimeFarFromNow();
      const meal = await logMint();

      await fireEvent.press(screen.getByRole('checkbox', { name: 'Heartburn' }));
      await press('Done');

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(`meal-${meal.id}`);
    });

    it('stays when the check-in is completed with no symptoms', async () => {
      mockReminderMinutes = 120;
      mockBedtime = bedtimeFarFromNow();
      await logMint();

      await press('Done');

      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });
  });

  /** Opens a "+" chip, types, and presses return. */
  const addOwn = async (label: string, text: string) => {
    await fireEvent.press(screen.getByRole('button', { name: label }));
    const field = screen.getByLabelText(label);
    await fireEvent.changeText(field, text);
    await fireEvent(field, 'submitEditing');
  };

  it('adds a lifestyle factor of your own with the + chip: picked, saved to My additions, tagged on the meal', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');
    await screen.findByRole('header', { name: 'Your belly might not love this.' });
    await press('I ate this');
    await addDetails();

    await addOwn("Add your own to What's going on?", '  Skipped   breakfast ');

    expect(screen.getByRole('checkbox', { name: 'Skipped breakfast', checked: true })).toBeTruthy();
    expect(listSavedSymptoms(mockDb).map((row) => [row.name, row.kind])).toEqual([
      ['Skipped breakfast', 'lifestyle'],
    ]);
    await press('Done');

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(listMealTags(mockDb, meal.id)).toEqual(['custom:Skipped breakfast']);
  });

  it('adds a symptom of your own with the + chip and links it to the meal', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');
    await screen.findByRole('header', { name: 'Your belly might not love this.' });
    await press('I ate this');
    await addDetails();

    await addOwn('Add your own symptom', 'Hiccups');

    expect(screen.getByRole('checkbox', { name: 'Hiccups', checked: true })).toBeTruthy();
    expect(listSavedSymptoms(mockDb).map((row) => [row.name, row.kind])).toEqual([['Hiccups', 'symptom']]);
    await press('Done');

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    const [symptomLog] = listSymptomLogs(mockDb, ALL_TIME);
    expect(symptomLog).toMatchObject({ foodLogId: meal.id });
    expect(symptomLog.items.map((item) => item.key)).toEqual(['custom:Hiccups']);
  });

  it('offers what you added before as chips, and typing a built-in name picks that chip', async () => {
    createSavedSymptom(mockDb, 'Skipped breakfast', 'lifestyle');
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');
    await screen.findByRole('header', { name: 'Your belly might not love this.' });
    await press('I ate this');
    await addDetails();

    expect(screen.getByRole('checkbox', { name: 'Skipped breakfast', checked: false })).toBeTruthy();
    await addOwn("Add your own to What's going on?", 'stress');

    expect(screen.getByRole('checkbox', { name: 'Stress', checked: true })).toBeTruthy();
    expect(listSavedSymptoms(mockDb).map((row) => row.name)).toEqual(['Skipped breakfast']);
  });
});

describe('Log food screen (photo)', () => {
  const photo = { uri: 'file:///cache/prepared.jpg', width: 1024, height: 768 };

  it('sends the prepared photo, then stores it and saves the diary entry', async () => {
    pick.mockResolvedValue({ status: 'ok', photo });
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);

    await takePhoto();
    expect(await screen.findByRole('header', { name: 'Your belly might not love this.' })).toBeTruthy();
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
    expect(mockBack).toHaveBeenCalledTimes(2); // Today after "I ate this", and again after the check-in
  });

  it('shows the photo loader while the photo is prepared and analyzed', async () => {
    let resolve!: (value: unknown) => void;
    analyze.mockReturnValue(new Promise((r) => (resolve = r)));
    pick.mockResolvedValue({ status: 'ok', photo });
    await render(<LogFoodScreen />);

    await takePhoto();

    expect(await screen.findByText('loading:photo')).toBeTruthy();
    await act(async () => resolve(result));
    await screen.findByRole('header', { name: 'Your belly might not love this.' });
  });

  it('keeps the form while the system picker is open and checks the photo as soon as it is chosen', async () => {
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
    expect(screen.getByRole('button', { name: 'Take a photo' })).toBeTruthy();

    await act(async () => onPicked());
    expect(screen.getByText('loading:photo')).toBeTruthy(); // preparing the photo

    await act(async () => choose({ status: 'ok', photo }));
    expect(await screen.findByRole('header', { name: 'Your belly might not love this.' })).toBeTruthy();
  });

  it('can pick from the library', async () => {
    pick.mockResolvedValue({ status: 'ok', photo });
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);

    await choosePhoto();

    await screen.findByRole('header', { name: 'Your belly might not love this.' });
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
    expect(screen.getByRole('button', { name: 'Take a photo' })).toBeEnabled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('ignores a photoUri link, so a link cannot make it send some local file', async () => {
    mockParams = { photoUri: photo.uri };
    await render(<LogFoodScreen />);

    expect(screen.getByRole('button', { name: 'Take a photo' })).toBeEnabled();
    expect(analyze).not.toHaveBeenCalled();
  });

  it('goes back to where it was opened from when the camera it opened is closed', async () => {
    mockParams = { camera: '1' };
    pick.mockResolvedValue({ status: 'canceled' });
    await render(<LogFoodScreen />);

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(analyze).not.toHaveBeenCalled();
  });

  it('stays on the screen and explains when the camera is denied access', async () => {
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

    expect(await screen.findByText(friendlyMessages.NOT_FOOD)).toBeTruthy();
    // The photo stays, so the user can retry, or log the meal without a verdict.
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Choose a different photo' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Just log it' })).toBeEnabled();
  });

  it('logs a photo whose check failed without a verdict, and stays on the photo until then', async () => {
    pick.mockResolvedValue({ status: 'ok', photo });
    analyze.mockRejectedValue(new AppError('NETWORK'));
    await render(<LogFoodScreen />);
    await takePhoto();
    await screen.findByText(friendlyMessages.NETWORK);
    expect(screen.queryByRole('button', { name: 'Just log it' })).toBeTruthy();
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);

    await press('Just log it');

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toMatchObject([
      { mealName: 'Meal', source: 'photo', overallVerdict: null },
    ]);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/completion',
      params: expect.objectContaining({ kind: 'meal' }),
    });
  });

  it('cancels a check in progress and returns to the typed meal, nothing lost', async () => {
    analyze.mockReturnValue(new Promise(() => {}));
    await render(<LogFoodScreen />);
    await type('dim sum');
    await press('Check this meal');
    expect(screen.getByText('loading:text')).toBeTruthy();

    await press('Cancel');

    expect(screen.queryByText('loading:text')).toBeNull();
    expect(screen.getByDisplayValue('dim sum')).toBeTruthy();
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
  });

  it('keeps the photo with its stored check if "I ate this" cannot save', async () => {
    pick.mockResolvedValue({ status: 'ok', photo });
    analyze.mockResolvedValue(result);
    // The check stores one copy when the result arrives; the diary fallback stores another.
    store
      .mockReset()
      .mockReturnValueOnce('file:///doc/photos/check.jpg')
      .mockReturnValueOnce('file:///doc/photos/retry.jpg');
    await render(<LogFoodScreen />);
    await takePhoto();
    await screen.findByRole('header', { name: 'Your belly might not love this.' });

    closeDb();
    await press('I ate this');

    // Only the failed retry's copy goes; the check's own photo is still referenced by the check.
    expect(removePhoto).toHaveBeenCalledTimes(1);
    expect(removePhoto).toHaveBeenCalledWith('file:///doc/photos/retry.jpg');
    expect(mockToast).toHaveBeenCalledWith("We couldn't save that. Please try again.");
    expect(mockBack).not.toHaveBeenCalled();
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
    await screen.findByRole('header', { name: 'Your belly might not love this.' });
  };

  it('saves the verdict on screen without another call when there is no comment', async () => {
    analyze.mockResolvedValue(result);
    await analyzeSoup();
    await ateThis();

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)[0]).toMatchObject({ mealName: 'Mint tea' });
  });

  it('sends no portion with the check or the update (it is chosen when editing the entry)', async () => {
    analyze.mockResolvedValueOnce(result).mockResolvedValueOnce(corrected);
    await render(<LogFoodScreen />);

    await type('soup');
    expect(screen.queryByRole('button', { name: 'Portion, Regular' })).toBeNull();
    await press('Check this meal');

    expect(await screen.findByRole('header', { name: 'Your belly might not love this.' })).toBeTruthy();
    expect(analyze).toHaveBeenCalledWith({ text: 'soup' }, expect.any(AbortSignal));

    await tellUs('pumpkin');
    await press('Update verdict');
    await screen.findByRole('header', { name: 'Your belly should be happy with this.' });
    expect(analyze).toHaveBeenLastCalledWith({ text: 'soup', details: 'pumpkin' });
  });

  it('only lets "Update verdict" go once there is a comment', async () => {
    analyze.mockResolvedValue(result);
    await analyzeSoup();

    await press('Not quite right?');
    expect(screen.getByRole('button', { name: 'Update verdict' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Tell us more'), '   ');
    expect(screen.getByRole('button', { name: 'Update verdict' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Tell us more'), 'pumpkin');
    expect(screen.getByRole('button', { name: 'Update verdict' })).toBeEnabled();
  });

  it('updates the verdict when Done is pressed on the keyboard, not only on the button', async () => {
    analyze.mockResolvedValueOnce(result).mockResolvedValueOnce(corrected);
    await analyzeSoup();

    await tellUs('pumpkin');
    await fireEvent(screen.getByLabelText('Tell us more'), 'submitEditing');

    expect(await screen.findByRole('header', { name: 'Your belly should be happy with this.' })).toBeTruthy();
    expect(analyze).toHaveBeenLastCalledWith({ text: 'soup', details: 'pumpkin' });
  });

  it('does nothing on keyboard Done while the comment is blank', async () => {
    analyze.mockResolvedValue(result);
    await analyzeSoup();

    await tellUs('   ');
    await fireEvent(screen.getByLabelText('Tell us more'), 'submitEditing');

    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it('shows the updated verdict before saving, then saves it with no further call', async () => {
    analyze.mockResolvedValueOnce(result).mockResolvedValueOnce(corrected);
    await analyzeSoup();

    await tellUs(" it's pumpkin, no cream ");
    await press('Update verdict');

    expect(await screen.findByRole('header', { name: 'Your belly should be happy with this.' })).toBeTruthy();
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
    expect(mockBack).toHaveBeenCalledTimes(2); // Today after "I ate this", and again after the check-in
  });

  it('tells the relay what you are managing on the check and on the update', async () => {
    setSetting(mockDb, 'conditions', ['acid_reflux', 'lpr']);
    analyze.mockResolvedValueOnce(result).mockResolvedValueOnce(corrected);
    await analyzeSoup();
    expect(analyze).toHaveBeenLastCalledWith(
      { text: 'soup', conditions: ['acid_reflux', 'lpr'] },
      expect.any(AbortSignal),
    );

    await tellUs('it is pumpkin soup');
    await press('Update verdict');
    await screen.findByRole('header', { name: 'Your belly should be happy with this.' });

    expect(analyze).toHaveBeenLastCalledWith({
      text: 'soup',
      details: 'it is pumpkin soup',
      conditions: ['acid_reflux', 'lpr'],
    });
  });

  it('builds each update on earlier details and comments', async () => {
    pick.mockResolvedValue({ status: 'ok', photo });
    analyze.mockResolvedValueOnce(result).mockResolvedValueOnce(corrected).mockResolvedValueOnce(corrected);
    await render(<LogFoodScreen />);
    await takePhoto();
    await screen.findByRole('header', { name: 'Your belly might not love this.' });

    await tellUs('it is pumpkin soup');
    await press('Update verdict');
    await screen.findByRole('header', { name: 'Your belly should be happy with this.' });
    await tellUs('no cream');
    await press('Update verdict');
    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(3));

    expect(analyze).toHaveBeenLastCalledWith({
      photo: { uri: photo.uri, mimeType: 'image/jpeg' },
      details: 'it is pumpkin soup. no cream',
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
    expect(await screen.findByRole('header', { name: 'Your belly should be happy with this.' })).toBeTruthy();
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
    expect(screen.getByRole('header', { name: 'Your belly might not love this.' })).toBeTruthy();
    await press('Not quite right?');
    expect(screen.getByLabelText('Tell us more').props.value).toBe('pumpkin');
  });
});

describe('Food screen for Favorite foods', () => {
  const photo = { uri: 'file:///cache/prepared.jpg', width: 1024, height: 768 };

  it('checks a photo and saves it with its verdict to favorite foods, not the diary', async () => {
    mockParams = { myFood: '1' };
    pick.mockResolvedValue({ status: 'ok', photo });
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);

    expect(screen.getByText('Add a favorite food')).toBeTruthy();
    await takePhoto();
    await screen.findByRole('header', { name: 'Your belly might not love this.' });
    await press('Save to favorite foods');

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
    expect(mockToast).toHaveBeenCalledWith('Mint tea added to favorite foods');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('can still add a typed food by name without a verdict', async () => {
    mockParams = { myFood: '1' };
    createSavedFood(mockDb, 'Oatmeal');
    await render(<LogFoodScreen />);

    expect(screen.queryByRole('header', { name: 'Favorite foods' })).toBeNull();
    // A saved food isn't eaten, so there is no meal time to pick.
    expect(screen.queryByRole('button', { name: /^When did you eat this\?/ })).toBeNull();
    expect(screen.queryByText('What did you eat?')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Describe it'), '  Banana bread ');
    await press('Just save it');

    expect(listSavedFoods(mockDb).map((food) => food.mealName)).toEqual(['Banana bread', 'Oatmeal']);
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(analyze).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith('Banana bread added to favorite foods');
  });

  it('gives a saved food a verdict, starting from its name and keeping it', async () => {
    const id = createSavedFood(mockDb, 'My tea');
    mockParams = { myFood: '1', food: String(id) };
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);

    expect(screen.getByRole('header', { name: 'Get a verdict' })).toBeTruthy();
    expect(screen.getByLabelText('Describe it').props.value).toBe('My tea');
    expect(screen.queryByRole('button', { name: 'Just log it' })).toBeNull();
    await press('Check this meal');
    await screen.findByRole('header', { name: 'Your belly might not love this.' });
    await press('Save to favorite foods');

    expect(listSavedFoods(mockDb)).toMatchObject([{ id, mealName: 'My tea', overallVerdict: 'caution' }]);
    expect(mockToast).toHaveBeenCalledWith('Updated My tea in favorite foods');
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
    await press('Set time');
  };
  const checkMintTea = async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');
    await screen.findByRole('header', { name: 'Your belly might not love this.' });
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
    await screen.findByRole('header', { name: 'Your belly might not love this.' });
    expect(screen.queryByText('When did you eat this?')).toBeNull();
  });

  it('shows the time on the details, with a wheel limited to the past week', async () => {
    await checkMintTea();
    await press('I ate this');

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(1); // logged as of now; the time can still change
    await addDetails();
    await fireEvent.press(timePill());
    expect(screen.getByText('When did you eat this?')).toBeTruthy();
    const now = new Date();
    expect(mockWheel?.maximumDate.getTime()).toBeLessThanOrEqual(Date.now());
    expect(mockWheel?.minimumDate).toEqual(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  });

  it('saves at the chosen time', async () => {
    await checkMintTea();
    await press('I ate this');
    await addDetails();
    await setTime(yesterdayBreakfast());
    await press('Done');

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(meal.loggedAt).toBe(yesterdayBreakfast().toISOString());
    expect(mockBack).toHaveBeenCalledTimes(2);
  });

  it('keeps a changed time when the check-in is skipped, without keeping the tags', async () => {
    await checkMintTea();
    await press('I ate this');
    await addDetails();
    await setTime(yesterdayBreakfast());
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Stress' }));
    await press('Skip for now');

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(meal.loggedAt).toBe(yesterdayBreakfast().toISOString());
    expect(listMealTags(mockDb, meal.id)).toEqual([]);
    expect(mockBack).toHaveBeenCalledTimes(2);
  });

  it('saves at noon of the day tapped in the week strip', async () => {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const key = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    mockParams = { date: key };
    await checkMintTea();
    await ateThis();

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(meal.loggedAt).toBe(
      new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 12, 0).toISOString(),
    );
  });

  it('saves as eaten right now when the time is left alone', async () => {
    await checkMintTea();
    const before = Date.now();
    await ateThis();

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(new Date(meal.loggedAt).getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(new Date(meal.loggedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('keeps the logged time if the time sheet is dismissed', async () => {
    await checkMintTea();
    await press('I ate this');
    const [before] = listDiaryFoodLogs(mockDb, ALL_TIME);
    await addDetails();
    await fireEvent.press(timePill());
    await fireEvent.press(screen.getAllByLabelText('Close', { includeHiddenElements: true })[0]);
    await press('Done');

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)[0].loggedAt).toBe(before.loggedAt);
  });

  it('lets "Log without checking" change the time afterwards too', async () => {
    await render(<LogFoodScreen />);
    await type('toast and eggs');

    await press('Just log it');
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(1);
    await addDetails();
    await setTime(yesterdayBreakfast());
    await press('Done');

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(meal.mealName).toBe('toast and eggs');
    expect(meal.loggedAt).toBe(yesterdayBreakfast().toISOString());
  });

  it('never saves a time that has not happened yet', async () => {
    await render(<LogFoodScreen />);
    await type('toast');
    await press('Just log it');
    await addDetails();
    await setTime(new Date(Date.now() + 60 * 60 * 1000));
    await press('Done');

    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(new Date(meal.loggedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe('Log food screen: Quick log', () => {
  const { meta, ...analysis } = result;
  const saveOatmeal = () =>
    saveCheckedFood(mockDb, {
      source: 'text',
      inputText: 'Oatmeal with banana',
      photoUri: null,
      analysis: { ...analysis, mealName: 'Oatmeal with banana' } as never,
      meta,
    });

  it('shows no favorite chips until a food is saved', async () => {
    await render(<LogFoodScreen />);
    expect(screen.queryByLabelText('Favorite foods')).toBeNull();
  });

  it('shows the saved foods on the capture step while the field is empty, and hides them once you type', async () => {
    saveOatmeal();
    createSavedFood(mockDb, 'Mint tea');
    await render(<LogFoodScreen />);

    expect(screen.getByLabelText('Favorite foods')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Oatmeal with banana' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mint tea' })).toBeTruthy();

    await type('oat');
    expect(screen.queryByLabelText('Favorite foods')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mint tea' })).toBeNull();

    await type('');
    expect(screen.getByLabelText('Favorite foods')).toBeTruthy();
  });

  it('has no See all link: Favorite foods is managed from Profile', async () => {
    saveOatmeal();
    await render(<LogFoodScreen />);
    expect(screen.queryByRole('button', { name: 'See all' })).toBeNull();
  });

  it('logs the saved food right away with its saved verdict, then opens the check-in', async () => {
    const { id } = saveOatmeal();
    await render(<LogFoodScreen />);

    const chip = screen.getByRole('button', { name: 'Oatmeal with banana' });
    await fireEvent.press(chip);
    await fireEvent.press(chip);

    const meals = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(meals).toHaveLength(1);
    expect(meals[0]).toMatchObject({ mealName: 'Oatmeal with banana', overallVerdict: 'caution' });
    expect(mockToast).not.toHaveBeenCalled(); // the completion page, not a toast
    await addDetails();
    expect(screen.getByRole('header', { name: 'Oatmeal with banana' })).toBeTruthy();
    // Already one of the favorite foods, so there is nothing to add.
    expect(screen.queryByRole('checkbox', { name: 'Add to favorite foods' })).toBeNull();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Stress' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Heartburn' }));
    const done = screen.getByRole('button', { name: 'Done' });
    await fireEvent.press(done);
    await fireEvent.press(done);

    expect(listMealTags(mockDb, meals[0].id)).toEqual(['stress']);
    expect(listSymptomLogs(mockDb, ALL_TIME)[0]).toMatchObject({ foodLogId: meals[0].id });
    expect(listSavedFoods(mockDb).map((food) => food.id)).toEqual([id]);
    expect(analyze).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalledTimes(2); // Today after the chip, and again after the check-in
  });

  describe('from the home-screen widget (?quickLog=<id>&t=<token>)', () => {
    it('logs the saved food on arrival, once, and opens the check-in', async () => {
      const { id } = saveOatmeal();
      setSetting(mockDb, 'widgetToken', 'secret-token');
      mockParams = { quickLog: String(id), t: 'secret-token' };
      await render(<LogFoodScreen />);

      const meals = listDiaryFoodLogs(mockDb, ALL_TIME);
      expect(meals).toHaveLength(1);
      expect(meals[0]).toMatchObject({ mealName: 'Oatmeal with banana', overallVerdict: 'caution' });
      expect(mockToast).not.toHaveBeenCalled(); // the completion page, not a toast
      await addDetails();
      expect(screen.getByRole('header', { name: 'Oatmeal with banana' })).toBeTruthy();
      expect(analyze).not.toHaveBeenCalled();
    });

    it.each([
      ['wrong', 'guess'],
      ['missing', undefined],
    ])('logs nothing when the token is %s, and is just the Food screen', async (_case, t) => {
      const { id } = saveOatmeal();
      setSetting(mockDb, 'widgetToken', 'secret-token');
      mockParams = { quickLog: String(id), t };
      await render(<LogFoodScreen />);

      expect(screen.getByLabelText('Favorite foods')).toBeTruthy();
      expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    });

    it('logs nothing before a widget token exists, even for an empty token', async () => {
      const { id } = saveOatmeal();
      mockParams = { quickLog: String(id), t: '' };
      await render(<LogFoodScreen />);
      expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    });

    it('falls back to the Food screen for a food that was removed', async () => {
      setSetting(mockDb, 'widgetToken', 'secret-token');
      mockParams = { quickLog: '999', t: 'secret-token' };
      await render(<LogFoodScreen />);
      expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
      expect(screen.getByLabelText('Describe it')).toBeTruthy();
    });
  });

  it('ends the flow from the X on the details, keeping the meal that was logged', async () => {
    saveOatmeal();
    await render(<LogFoodScreen />);
    await press('Oatmeal with banana');
    await addDetails();
    await press('Close');
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(1);
    expect(mockBack).toHaveBeenCalledTimes(2);
  });

  it("has no Quick log in the Food list's own check or for Favorite foods", async () => {
    saveOatmeal();
    mockParams = { myFood: '1' };
    await render(<LogFoodScreen />);
    expect(screen.queryByLabelText('Favorite foods')).toBeNull();
  });
});

describe('Log food screen: food suggestions under the field', () => {
  const { meta, ...analysis } = result;
  const saveOatmeal = () =>
    saveCheckedFood(mockDb, {
      source: 'text',
      inputText: 'Oatmeal with banana',
      photoUri: null,
      analysis: { ...analysis, mealName: 'Oatmeal with banana' } as never,
      meta,
    });
  const field = () => screen.getByLabelText('Describe it');

  it('suggests nothing until something is typed, or when nothing matches', async () => {
    await render(<LogFoodScreen />);
    expect(screen.queryByRole('button', { name: 'Oatmeal' })).toBeNull();
    await type('zzzz');
    expect(screen.queryByRole('button', { name: /Oat/ })).toBeNull();
  });

  it('fills the field from a common food, and does not check it yet', async () => {
    await render(<LogFoodScreen />);
    await type('oat');
    await press('Oatmeal');

    expect(field().props.value).toBe('Oatmeal');
    expect(analyze).not.toHaveBeenCalled();
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    // Typed in full, so it is not suggested back.
    expect(screen.queryByRole('button', { name: 'Oatmeal' })).toBeNull();
  });

  it('suggests past meals, and fills the field from one', async () => {
    createUncheckedMeal(mockDb, { source: 'text', inputText: 'Lentil stew' });
    await render(<LogFoodScreen />);
    await type('lent');
    await press('Lentil stew');
    expect(field().props.value).toBe('Lentil stew');
  });

  it('shows the favorite first and the rest A to Z, and a favorite logs at once with its saved verdict', async () => {
    saveOatmeal();
    await render(<LogFoodScreen />);
    await type('oat');

    const names = screen
      .getAllByRole('button')
      .map((button) => button.props.accessibilityLabel as string | undefined)
      .filter((label): label is string => /^Oat/i.test(label ?? ''));
    expect(names[0]).toBe('Oatmeal with banana, favorite, logs now');
    const rest = names.slice(1);
    expect(rest.length).toBeGreaterThan(1);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b)));

    await press('Oatmeal with banana, favorite, logs now');
    const meals = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(meals).toHaveLength(1);
    expect(meals[0]).toMatchObject({ mealName: 'Oatmeal with banana', overallVerdict: 'caution' });
    expect(analyze).not.toHaveBeenCalled();
  });

  it("leaves out favorites in the Food list's own check, where there is no Quick log", async () => {
    saveOatmeal();
    mockParams = { myFood: '1' };
    await render(<LogFoodScreen />);
    await type('oat');
    expect(screen.queryByRole('button', { name: /favorite, logs now/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Oatmeal' })).toBeTruthy();
  });
});

describe('Log food screen: after "I ate this"', () => {
  const eatMintTea = async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');
    await screen.findByRole('header', { name: 'Your belly might not love this.' });
    await press('I ate this');
  };

  it('goes back to Today and opens the completion page, with no check-in page in the way', async () => {
    await eatMintTea();
    const [meal] = listDiaryFoodLogs(mockDb, ALL_TIME);

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/completion',
      params: { kind: 'meal', id: String(meal.id) },
    });
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(1);
  });

  it('is just the Food screen when the meal for ?details is gone', async () => {
    mockParams = { details: '999' };
    await render(<LogFoodScreen />);

    expect(screen.getByLabelText('Describe it')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
  });
});

describe('Log food screen: leaving without eating', () => {
  it('has no "Not eating this": the back arrow returns to the typed text and nothing is logged', async () => {
    analyze.mockResolvedValue(result);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');
    await screen.findByRole('header', { name: 'Your belly might not love this.' });
    expect(screen.queryByRole('button', { name: 'Not eating this' })).toBeNull();

    await press('Back');

    expect(screen.getByLabelText('Describe it').props.value).toBe('mint tea');
    expect(listDiaryFoodLogs(mockDb, ALL_TIME).filter((meal) => meal.entryType === 'diary')).toHaveLength(0);
    expect(mockToast).not.toHaveBeenCalled();
  });
});
