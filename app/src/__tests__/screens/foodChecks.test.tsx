import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import LogFoodScreen from '@/app/log/food';
import { createTestDb } from '@/db/__tests__/testDb';
import { listDiaryFoodLogs } from '@/db/repositories/food';
import { foodLogs } from '@/db/schema';
import type { AppDb } from '@/db/types';
import { AppError, friendlyMessages } from '@/lib/errors';
import { pickFoodPhoto } from '@/services/photoPicker';
import { savePhoto } from '@/services/photoStore';
import { analyzeFood } from '@/services/relayClient';

let mockDb: AppDb;
let closeDb: () => void;
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockSetOptions = jest.fn();
const mockToast = jest.fn();
let mockParams: { camera?: string; details?: string } = {};

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
// The native wheel can't render here; leaving it alone means "eaten right now".
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
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
    replace: jest.fn(),
  },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ setOptions: mockSetOptions }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]),
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));

const analyze = analyzeFood as jest.Mock;
const pick = pickFoodPhoto as jest.Mock;
const store = savePhoto as jest.Mock;

const mintTea = {
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
const chamomile = {
  ...mintTea,
  mealName: 'Chamomile tea',
  items: [{ ...mintTea.items[0], name: 'Chamomile tea', verdict: 'ok', matchedTriggers: [] }],
  overall: { verdict: 'ok', confidence: 'high', reasoning: 'Chamomile is usually gentle.' },
};

const ALL_TIME = { from: '2000-01-01T00:00:00.000Z', to: '2100-01-01T00:00:00.000Z' };
const allRows = () => mockDb.select().from(foodLogs).all();
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
/** "I ate this" goes back to Today; the toast's Add details and Done finish it. */
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
  mockToast.mockClear();
  mockPush.mockClear();
  mockParams = {};
  analyze.mockReset();
  pick.mockReset();
  store.mockReset().mockReturnValue('file:///doc/photos/meal.jpg');
});

afterEach(() => closeDb());

describe('Food screen: checks and "I ate this"', () => {
  it('"mint tea" → Caution citing mint → "I ate this" puts it in the diary with no second relay call', async () => {
    analyze.mockResolvedValue(mintTea);
    await render(<LogFoodScreen />);

    await type('mint tea');
    await press('Check this meal');

    expect(await screen.findByRole('header', { name: 'Your belly might not love this.' })).toBeTruthy();
    // Checked, not eaten: stored as a check, outside the diary (and so the pet).
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(allRows()).toMatchObject([{ entryType: 'check', inputText: 'mint tea' }]);

    await ateThis();

    expect(analyze).toHaveBeenCalledTimes(1);
    const diary = listDiaryFoodLogs(mockDb, ALL_TIME);
    expect(diary).toHaveLength(1);
    expect(diary[0]).toMatchObject({
      source: 'text',
      inputText: 'mint tea',
      mealName: 'Mint tea',
      overallVerdict: 'caution',
      analysisMeta: mintTea.meta,
    });
    expect(diary[0].analysis?.items[0].matchedTriggers[0]?.category).toBe('mint');
    expect(allRows()).toHaveLength(1); // the check itself was promoted, not copied
    // The completion page opens once; completing the check-in then opens none, and there is no toast.
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockPush.mock.calls.filter(([to]) => to?.pathname === '/completion')).toHaveLength(1);
    expect(mockBack).toHaveBeenCalledTimes(2); // back to Today after "I ate this", and again after the check-in
  });

  it('keeps the check, outside the diary, when going back from the verdict', async () => {
    analyze.mockResolvedValue(mintTea);
    await render(<LogFoodScreen />);
    await type('mint tea');
    await press('Check this meal');
    await screen.findByRole('header', { name: 'Your belly might not love this.' });

    await press('Back');

    // Back walks to the capture step, with what was typed still there; nothing is saved to the diary.
    expect(screen.getByLabelText('Describe it').props.value).toBe('mint tea');
    expect(allRows()).toMatchObject([{ mealName: 'Mint tea', entryType: 'check' }]);
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('opens the camera straight away when reached from Scan, once', async () => {
    mockParams = { camera: '1' };
    pick.mockResolvedValue({ status: 'canceled' });
    await render(<LogFoodScreen />);

    await waitFor(() => expect(pick).toHaveBeenCalledWith('camera', expect.any(Function)));
    // Cancelling leaves the full screen to choose from, without re-opening the camera.
    expect(await screen.findByRole('button', { name: 'Take a photo' })).toBeTruthy();
    expect(pick).toHaveBeenCalledTimes(1);
  });

  it('does not open the camera when reached from the + menu', async () => {
    await render(<LogFoodScreen />);
    expect(pick).not.toHaveBeenCalled();
  });

  it('updates the stored check with a comment, then promotes that same check', async () => {
    analyze.mockResolvedValueOnce(mintTea).mockResolvedValueOnce(chamomile);
    await render(<LogFoodScreen />);
    await type('herbal tea');
    await press('Check this meal');
    await screen.findByRole('header', { name: 'Your belly might not love this.' });

    await tellUs('it was chamomile');
    await press('Update verdict');
    await screen.findByRole('header', { name: 'Your belly should be happy with this.' });
    expect(allRows()).toMatchObject([{ entryType: 'check', mealName: 'Chamomile tea' }]);

    await ateThis();

    expect(analyze).toHaveBeenCalledTimes(2);
    expect(analyze).toHaveBeenLastCalledWith({ text: 'herbal tea', details: 'it was chamomile' });
    expect(allRows()).toMatchObject([
      { entryType: 'diary', mealName: 'Chamomile tea', overallVerdict: 'ok', inputText: 'herbal tea' },
    ]);
  });

  it('stores a checked photo once and reuses it on "I ate this"', async () => {
    pick.mockResolvedValue({ status: 'ok', photo: { uri: 'file:///cache/prepared.jpg' } });
    analyze.mockResolvedValue(mintTea);
    await render(<LogFoodScreen />);

    await takePhoto();
    await screen.findByRole('header', { name: 'Your belly might not love this.' });
    await ateThis();

    expect(store).toHaveBeenCalledTimes(1);
    expect(allRows()).toMatchObject([
      { entryType: 'diary', source: 'photo', photoUri: 'file:///doc/photos/meal.jpg' },
    ]);
  });

  it('still saves to the diary when storing the check failed', async () => {
    pick.mockResolvedValue({ status: 'ok', photo: { uri: 'file:///cache/prepared.jpg' } });
    store.mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    analyze.mockResolvedValue(mintTea);
    await render(<LogFoodScreen />);

    await choosePhoto();
    await screen.findByRole('header', { name: 'Your belly might not love this.' });
    expect(allRows()).toHaveLength(0);

    await ateThis();

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(allRows()).toMatchObject([{ entryType: 'diary', photoUri: 'file:///doc/photos/meal.jpg' }]);
  });
});

describe('Food screen: saving without a verdict', () => {
  it('saves a typed meal as a diary entry at once, and keeps it without a verdict while the check cannot run', async () => {
    analyze.mockRejectedValue(new AppError('OFFLINE'));
    await render(<LogFoodScreen />);
    expect(screen.queryByRole('button', { name: 'Just log it' })).toBeNull();

    await type('  grilled fish  ');
    await press('Just log it');
    await addDetails();
    await press('Done');

    await waitFor(() => expect(analyze).toHaveBeenCalledWith({ text: 'grilled fish' }));
    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toMatchObject([
      {
        entryType: 'diary',
        source: 'text',
        inputText: 'grilled fish',
        mealName: 'grilled fish',
        overallVerdict: null,
        analysis: null,
        analysisMeta: null,
      },
    ]);
    expect(mockToast).not.toHaveBeenCalled(); // the completion page, not a toast
    expect(mockBack).toHaveBeenCalledTimes(2);
  });

  it('checks a photo as soon as it is taken, and offers no unchecked save or photo swap on the verdict', async () => {
    pick.mockResolvedValue({ status: 'ok', photo: { uri: 'file:///cache/prepared.jpg' } });
    analyze.mockResolvedValue(mintTea);
    await render(<LogFoodScreen />);
    await choosePhoto();

    await screen.findByRole('header', { name: 'Your belly might not love this.' });
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Just log it' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Choose a different photo' })).toBeNull();
  });

  it('still offers it after an offline failure, and saves the typed text', async () => {
    analyze.mockRejectedValue(new AppError('OFFLINE'));
    await render(<LogFoodScreen />);
    await type('rice and beans');
    await press('Check this meal');
    expect(await screen.findByText(friendlyMessages.OFFLINE)).toBeTruthy();

    await press('Just log it');
    await addDetails();
    await press('Done');

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toMatchObject([
      { inputText: 'rice and beans', overallVerdict: null },
    ]);
  });
});
