import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import TabsLayout from '@/app/(tabs)/_layout';
import { pickFoodPhoto } from '@/services/photoPicker';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
let mockActiveRoute = 'index';

jest.mock('expo-router', () => ({ router: { push: (href: unknown) => mockPush(href) } }));
jest.mock('@/services/photoPicker', () => ({ pickFoodPhoto: jest.fn() }));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));

const pick = pickFoodPhoto as jest.Mock;
// Reanimated's native runtime can't load in Jest; use its mocks (which lack useReducedMotion).
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));

// The real Tabs needs a navigation container; this stand-in just renders the custom bar it is given.
jest.mock('expo-router/js-tabs', () => {
  const Tabs = ({ tabBar }: { tabBar: (props: unknown) => React.ReactNode }) =>
    tabBar({
      state: {
        index: 0,
        routes: [{ name: mockActiveRoute }],
      },
      navigation: { navigate: (name: string) => mockNavigate(name) },
      insets: { top: 0, bottom: 34, left: 0, right: 0 },
    });
  Tabs.Screen = function Screen() {
    return null;
  };
  return { Tabs };
});

beforeEach(() => {
  pick.mockReset();
  mockPush.mockClear();
  mockNavigate.mockClear();
  mockActiveRoute = 'index';
});

describe('Tabs layout', () => {
  it('marks the tab for the current screen', async () => {
    mockActiveRoute = 'history';
    await render(<TabsLayout />);

    expect(screen.getByRole('tab', { name: 'History' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByRole('tab', { name: 'Today' }).props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('has no Profile tab: Profile opens from Today', async () => {
    await render(<TabsLayout />);

    expect(screen.queryByRole('tab', { name: 'You' })).toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('switches to the tab that is tapped, and ignores a tap on the current one', async () => {
    await render(<TabsLayout />);

    await fireEvent.press(screen.getByRole('tab', { name: 'History' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Today' }));

    expect(mockNavigate.mock.calls).toEqual([['history']]);
  });
});

describe('Quick log arch', () => {
  it('stays closed until Log is tapped, then fans out food, symptom and medication', async () => {
    await render(<TabsLayout />);
    expect(screen.queryByRole('button', { name: 'Snap food' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    for (const name of ['Snap food', 'How I feel', 'Medication']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('opens the camera itself for Snap food, without opening the Food screen first', async () => {
    let finish: (value: unknown) => void = () => {};
    pick.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await render(<TabsLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Snap food' }));

    expect(pick).toHaveBeenCalledWith('camera');
    expect(mockPush).not.toHaveBeenCalled(); // nothing behind the camera
    expect(screen.queryByRole('button', { name: 'How I feel' })).toBeNull(); // and the arch has closed
    await act(async () => finish({ status: 'canceled' }));
  });

  it('opens the Food screen on the photo that was taken', async () => {
    pick.mockResolvedValue({ status: 'ok', photo: { uri: 'file:///cache/meal.jpg', width: 1, height: 1 } });
    await render(<TabsLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Snap food' }));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/log/food',
        params: { photoUri: 'file:///cache/meal.jpg' },
      }),
    );
  });

  it('stays where you were when the camera is closed without a photo', async () => {
    pick.mockResolvedValue({ status: 'canceled' });
    await render(<TabsLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Snap food' }));

    await waitFor(() => expect(pick).toHaveBeenCalledTimes(1));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('opens the Food screen to explain when camera access is denied', async () => {
    pick.mockResolvedValue({ status: 'denied' });
    await render(<TabsLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Snap food' }));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/log/food', params: { camera: '1' } }),
    );
  });

  it('opens the plain Food screen when the photo cannot be read', async () => {
    pick.mockRejectedValue(new Error('file:///private/path failed'));
    await render(<TabsLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Snap food' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/log/food'));
  });

  it('opens only one camera when Snap food is tapped again while it is busy', async () => {
    let finish: (value: unknown) => void = () => {};
    pick.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await render(<TabsLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Snap food' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Snap food' }));

    expect(pick).toHaveBeenCalledTimes(1);
    await act(async () => finish({ status: 'canceled' }));
  });

  it('opens the symptom and medication flows', async () => {
    await render(<TabsLayout />);

    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));
    await fireEvent.press(screen.getByRole('button', { name: 'How I feel' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Medication' }));

    expect(mockPush.mock.calls).toEqual([['/log/symptoms'], ['/log/medication']]);
  });

  it('closes from the close button without going anywhere', async () => {
    await render(<TabsLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('button', { name: 'Snap food' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Log' })).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('closes when the dimmed screen is tapped', async () => {
    await render(<TabsLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss quick log' }));

    expect(screen.queryByRole('button', { name: 'Snap food' })).toBeNull();
  });

  it('closes when a tab is tapped, and still switches to it', async () => {
    await render(<TabsLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    await fireEvent.press(screen.getByRole('tab', { name: 'History' }));

    expect(screen.queryByRole('button', { name: 'Snap food' })).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('history');
  });

  it('closes on the Android back button instead of leaving the screen', async () => {
    let onBack: Parameters<typeof BackHandler.addEventListener>[1] = () => false;
    const add = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, handler) => {
      onBack = handler;
      return { remove: jest.fn() };
    });
    await render(<TabsLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    const handled = await act(async () => onBack(undefined as never));

    expect(handled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Snap food' })).toBeNull();
    add.mockRestore();
  });
});
