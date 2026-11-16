import { fireEvent, render, screen } from '@testing-library/react-native';

import LogTypeScreen from '@/app/log/type';
import { createTestDb } from '@/db/__tests__/testDb';
import type { AppDb } from '@/db/types';

let mockDb: AppDb;
let closeDb: () => void;
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSetOptions = jest.fn();
let mockParams: { date?: string } = {};

jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => ({
    settings: { bedtime: '22:30', lateMealWindowMinutes: 180, checkInReminderMinutes: null },
  }),
}));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('@/components/Toast', () => ({ useToast: () => jest.fn() }));
jest.mock('@/services/relayClient', () => ({ analyzeFood: jest.fn() }));
jest.mock('@/services/photoPicker', () => ({ pickFoodPhoto: jest.fn() }));
jest.mock('@/services/photoStore', () => ({ savePhoto: jest.fn(), deletePhoto: jest.fn() }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    dismissTo: () => mockBack(),
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ setOptions: mockSetOptions }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]),
}));

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockParams = {};
  jest.clearAllMocks();
});
afterEach(() => closeDb());

const tab = (name: string) => screen.getByRole('tab', { name });
const selected = () => screen.getAllByRole('tab').map((el) => el.props.accessibilityState.selected);

describe('Type: Food, How I feel and Medication as tabs in one modal (Figma 48)', () => {
  it('opens on Food', async () => {
    await render(<LogTypeScreen />);

    expect(screen.getByRole('header', { name: 'What did you eat?' })).toBeTruthy();
    expect(selected()).toEqual([true, false, false]);
  });

  it('swaps the screen in place when a tab is tapped, without navigating', async () => {
    await render(<LogTypeScreen />);

    await fireEvent.press(tab('How I feel'));
    expect(screen.getByRole('header', { name: 'How are you feeling?' })).toBeTruthy();
    expect(selected()).toEqual([false, true, false]);

    await fireEvent.press(tab('Medication'));
    expect(screen.getByRole('header', { name: 'Which medication?' })).toBeTruthy();
    expect(selected()).toEqual([false, false, true]);

    await fireEvent.press(tab('Food'));
    expect(screen.getByRole('header', { name: 'What did you eat?' })).toBeTruthy();

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('has the swipe-down on for each fresh tab', async () => {
    await render(<LogTypeScreen />);
    await fireEvent.press(tab('Medication'));

    expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
  });
});
