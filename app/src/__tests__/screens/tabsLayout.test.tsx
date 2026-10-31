import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import TabsLayout from '@/app/(tabs)/_layout';
import { closeLogArch, openLogArch } from '@/lib/logArch';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
let mockActiveRoute = 'index';

jest.mock('expo-router', () => ({ router: { push: (href: unknown) => mockPush(href) } }));
// The layout holds the app tour, which saves that it was seen.
jest.mock('@/db/DatabaseProvider', () => ({ useSettings: () => ({ settings: {}, update: jest.fn() }) }));
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
        index: ['index', 'history', 'profile', 'settings'].indexOf(mockActiveRoute),
        routes: ['index', 'history', 'profile', 'settings'].map((name) => ({ name, key: `${name}-key` })),
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

  it('has Today, History, Profile and Settings tabs', async () => {
    await render(<TabsLayout />);

    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Today',
      'History',
      'Profile',
      'Settings',
    ]);
  });

  it.each([
    ['profile', 'Profile'],
    ['settings', 'Settings'],
  ])('marks the %s tab when that screen is current', async (route, name) => {
    mockActiveRoute = route;
    await render(<TabsLayout />);

    expect(screen.getByRole('tab', { name }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole('tab', { name: 'Today' }).props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('opens Profile and Settings from their tabs', async () => {
    await render(<TabsLayout />);

    await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Settings' }));

    expect(mockNavigate.mock.calls).toEqual([['profile-key'], ['settings-key']]);
  });

  it('switches to the tab that is tapped, and ignores a tap on the current one', async () => {
    await render(<TabsLayout />);

    await fireEvent.press(screen.getByRole('tab', { name: 'History' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Today' }));

    expect(mockNavigate.mock.calls).toEqual([['history-key']]);
  });
});

describe('Quick log arch', () => {
  it('stays closed until Log is tapped, then fans out food, symptom and medication', async () => {
    await render(<TabsLayout />);
    expect(screen.queryByRole('button', { name: 'Food' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    for (const name of ['Food', 'How I feel', 'Medication']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('opens the plain Food screen for Food and closes the arch', async () => {
    await render(<TabsLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Food' }));

    expect(mockPush.mock.calls).toEqual([['/log/food']]);
    expect(screen.queryByRole('button', { name: 'How I feel' })).toBeNull();
  });

  it('opens the symptom and medication flows', async () => {
    await render(<TabsLayout />);

    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));
    await fireEvent.press(screen.getByRole('button', { name: 'How I feel' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Medication' }));

    expect(mockPush.mock.calls).toEqual([['/log/symptoms'], ['/log/medication']]);
  });

  it('opens from Today (Bellie or a day in the week strip) and logs for that day', async () => {
    await render(<TabsLayout />);

    await act(async () => openLogArch('2026-10-28'));
    await fireEvent.press(screen.getByRole('button', { name: 'Food' }));
    await act(async () => openLogArch('2026-10-28'));
    await fireEvent.press(screen.getByRole('button', { name: 'How I feel' }));

    expect(mockPush.mock.calls).toEqual([
      [{ pathname: '/log/food', params: { date: '2026-10-28' } }],
      [{ pathname: '/log/symptoms', params: { date: '2026-10-28' } }],
    ]);
  });

  it('forgets the day once closed, so the + button logs for today', async () => {
    await render(<TabsLayout />);
    await act(async () => openLogArch('2026-10-28'));
    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss quick log' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Food' }));

    expect(mockPush.mock.calls).toEqual([['/log/food']]);
  });

  it('closes from the close button without going anywhere', async () => {
    await render(<TabsLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('button', { name: 'Food' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Log' })).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('closes when the dimmed screen is tapped', async () => {
    await render(<TabsLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss quick log' }));

    expect(screen.queryByRole('button', { name: 'Food' })).toBeNull();
  });

  it('closes when a tab is tapped, and still switches to it', async () => {
    await render(<TabsLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    await fireEvent.press(screen.getByRole('tab', { name: 'History' }));

    expect(screen.queryByRole('button', { name: 'Food' })).toBeNull();
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
    expect(screen.queryByRole('button', { name: 'Food' })).toBeNull();
    add.mockRestore();
  });
});
