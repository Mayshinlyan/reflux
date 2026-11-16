import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import TabsLayout from '@/app/(tabs)/_layout';
import { closeLogArch, openLogArch } from '@/lib/logArch';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
let mockActiveRoute = 'index';

jest.mock('expo-router', () => ({ router: { push: (href: unknown) => mockPush(href) } }));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));

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
        index: ['index', 'history', 'kitchen', 'profile'].indexOf(mockActiveRoute),
        routes: ['index', 'history', 'kitchen', 'profile'].map((name) => ({ name, key: `${name}-key` })),
      },
      // The real bar navigates by a route's key, not its name.
      navigateToTab: (key: string) => mockNavigate(key),
      insets: { top: 0, bottom: 34, left: 0, right: 0 },
    });
  Tabs.Screen = function Screen() {
    return null;
  };
  return { Tabs };
});

beforeEach(() => {
  mockPush.mockClear();
  mockNavigate.mockClear();
  mockActiveRoute = 'index';
  // The arch's state is shared, so one test's open arch must not reach the next.
  closeLogArch();
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

  it('has Today, History, Kitchen and Profile tabs, and no Settings tab', async () => {
    await render(<TabsLayout />);

    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Today',
      'History',
      'Kitchen',
      'Profile',
    ]);
  });

  it.each([
    ['kitchen', 'Kitchen'],
    ['profile', 'Profile'],
  ])('marks the %s tab when that screen is current', async (route, name) => {
    mockActiveRoute = route;
    await render(<TabsLayout />);

    expect(screen.getByRole('tab', { name }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole('tab', { name: 'Today' }).props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('opens Kitchen and Profile from their tabs', async () => {
    await render(<TabsLayout />);

    await fireEvent.press(screen.getByRole('tab', { name: 'Kitchen' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));

    expect(mockNavigate.mock.calls).toEqual([['kitchen-key'], ['profile-key']]);
  });

  it('switches to the tab that is tapped, and ignores a tap on the current one', async () => {
    await render(<TabsLayout />);

    await fireEvent.press(screen.getByRole('tab', { name: 'History' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Today' }));

    expect(mockNavigate.mock.calls).toEqual([['history-key']]);
  });
});

describe('Quick log arch', () => {
  it('stays closed until Log is tapped, then fans out Tell me and Type', async () => {
    await render(<TabsLayout />);
    expect(screen.queryByRole('button', { name: 'Type' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    for (const name of ['Tell me', 'Type']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('opens the Food screen for Type and closes the arch', async () => {
    await render(<TabsLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Type' }));

    expect(mockPush.mock.calls).toEqual([['/log/type']]);
    expect(screen.queryByRole('button', { name: 'Tell me' })).toBeNull();
  });

  it('opens the voice log for Tell me', async () => {
    await render(<TabsLayout />);

    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tell me' }));

    expect(mockPush.mock.calls).toEqual([['/log/voice']]);
  });

  it('opens from Today (Bellie or a day in the week strip) and logs for that day', async () => {
    await render(<TabsLayout />);

    await act(async () => openLogArch('2026-10-28'));
    await fireEvent.press(screen.getByRole('button', { name: 'Type' }));
    await act(async () => openLogArch('2026-10-28'));
    await fireEvent.press(screen.getByRole('button', { name: 'Tell me' }));

    expect(mockPush.mock.calls).toEqual([
      [{ pathname: '/log/type', params: { date: '2026-10-28' } }],
      [{ pathname: '/log/voice', params: { date: '2026-10-28' } }],
    ]);
  });

  it('forgets the day once closed, so the + button logs for today', async () => {
    await render(<TabsLayout />);
    await act(async () => openLogArch('2026-10-28'));
    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss quick log' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Type' }));

    expect(mockPush.mock.calls).toEqual([['/log/type']]);
  });

  it('closes from the close button without going anywhere', async () => {
    await render(<TabsLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('button', { name: 'Type' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Log' })).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('closes when the dimmed screen is tapped', async () => {
    await render(<TabsLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss quick log' }));

    expect(screen.queryByRole('button', { name: 'Type' })).toBeNull();
  });

  it('closes when a tab is tapped, and still switches to it', async () => {
    await render(<TabsLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    await fireEvent.press(screen.getByRole('tab', { name: 'History' }));

    expect(screen.queryByRole('button', { name: 'Type' })).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('history-key');
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
    expect(screen.queryByRole('button', { name: 'Type' })).toBeNull();
    add.mockRestore();
  });
});
