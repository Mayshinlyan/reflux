import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pencil, Trash } from 'lucide-react-native';

import { lightColors } from '@/theme';

import { ActionMenu } from '../ActionMenu';
import { FloatingTabBar, tabBarClearance, tabBarGap, tabBarHeight, tabTargetRect } from '../FloatingTabBar';
import { TopBar } from '../TopBar';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
// Reanimated's native runtime can't load in Jest; use its mocks (which lack useReducedMotion).
let mockReduceMotion = false;
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => mockReduceMotion,
}));

describe('FloatingTabBar', () => {
  afterEach(() => {
    mockReduceMotion = false;
  });

  it('has Log, Today, History, Profile and Settings, and reports the one tapped', async () => {
    const onSelect = jest.fn();
    await render(<FloatingTabBar active="today" bottomInset={0} onSelect={onSelect} />);

    for (const name of ['Log', 'Today', 'History', 'Profile', 'Settings']) {
      expect(screen.getByLabelText(name)).toBeTruthy();
    }
    await fireEvent.press(screen.getByLabelText('History'));
    await fireEvent.press(screen.getByLabelText('Log'));
    await fireEvent.press(screen.getByLabelText('Profile'));
    await fireEvent.press(screen.getByLabelText('Settings'));

    expect(onSelect).toHaveBeenNthCalledWith(1, 'history');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'log');
    expect(onSelect).toHaveBeenNthCalledWith(3, 'profile');
    expect(onSelect).toHaveBeenNthCalledWith(4, 'settings');
  });

  it('marks only the current tab as selected, with a small tan circle behind it and no background on the tabs', async () => {
    await render(<FloatingTabBar active="history" bottomInset={0} onSelect={jest.fn()} />);

    expect(screen.getByRole('tab', { name: 'History' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByRole('tab', { name: 'Today' }).props.accessibilityState).toMatchObject({
      selected: false,
    });
    for (const name of ['Today', 'History', 'Profile', 'Settings']) {
      expect(screen.getByRole('tab', { name })).not.toHaveStyle({ backgroundColor: lightColors.surface2 });
    }
    expect(screen.getByTestId('tab-highlight')).toHaveStyle({
      backgroundColor: lightColors.surface2,
      width: 44,
      height: 44,
    });
  });

  it('draws the selected tab solid ink and the other an inkMuted silhouette, with details cut out', async () => {
    // react-native-svg hands colours to the native view as opaque ARGB numbers.
    const argb = (hex: string) => String(parseInt(`FF${hex.slice(1)}`, 16));
    await render(<FloatingTabBar active="history" bottomInset={0} onSelect={jest.fn()} />);

    const today = JSON.stringify(screen.getByRole('tab', { name: 'Today' }));
    const history = JSON.stringify(screen.getByRole('tab', { name: 'History' }));

    expect(today).toContain(argb(lightColors.inkMuted));
    expect(today).not.toContain(argb(lightColors.ink));
    expect(history).toContain(argb(lightColors.ink));
    expect(history).not.toContain(argb(lightColors.inkMuted));
    // The cut-outs take the colour behind the icon: the pill for the muted one, the tan highlight for the selected one.
    expect(today).toContain(argb(lightColors.surface));
    expect(history).toContain(argb(lightColors.surface2));
  });

  it('puts the highlight on the selected tab and moves it with no animation when the tab changes', async () => {
    const { rerender } = await render(<FloatingTabBar active="today" bottomInset={0} onSelect={jest.fn()} />);
    expect(screen.getByTestId('tab-highlight')).toHaveStyle({ left: 18 });

    // Two tabs, then the Log slot, then two more: the last two sit 72 further right.
    for (const [active, left] of [
      ['history', 82],
      ['profile', 218],
      ['settings', 282],
    ] as const) {
      await rerender(<FloatingTabBar active={active} bottomInset={0} onSelect={jest.fn()} />);
      expect(screen.getByTestId('tab-highlight')).toHaveStyle({ left });
    }
    expect(screen.getByRole('tab', { name: 'Settings' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it.each([false, true])(
    'still works when a tab is pressed and released (Reduce Motion %s)',
    async (reduce) => {
      mockReduceMotion = reduce;
      const onSelect = jest.fn();
      await render(<FloatingTabBar active="today" bottomInset={0} onSelect={onSelect} />);

      const history = screen.getByRole('tab', { name: 'History' });
      await fireEvent(history, 'pressIn');
      await fireEvent(history, 'pressOut');
      await fireEvent.press(history);

      expect(onSelect).toHaveBeenCalledWith('history');
    },
  );

  it('keeps Log outside the tabs: four tabs, with Log as a separate button', async () => {
    await render(<FloatingTabBar active="today" bottomInset={0} onSelect={jest.fn()} />);

    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Today',
      'History',
      'Profile',
      'Settings',
    ]);
    expect(screen.queryByRole('tab', { name: 'Log' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Log' })).toBeTruthy();
  });

  it('keeps Log as the olive primary action, ringed in the page colour, whichever tab is current', async () => {
    await render(<FloatingTabBar active="history" bottomInset={0} onSelect={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Log' })).toHaveStyle({
      backgroundColor: lightColors.cta,
      borderColor: lightColors.bg,
      borderWidth: 5,
    });
  });

  it('turns Log into Close, reported as expanded, while the arch is open', async () => {
    await render(<FloatingTabBar active="today" logOpen bottomInset={0} onSelect={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Log' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Close' }).props.accessibilityState).toMatchObject({
      expanded: true,
    });
  });

  it('floats a 64 pill 16 above the edge without a home indicator, and lifts it with the indicator inset', () => {
    expect(tabBarGap(0)).toBe(16);
    expect(tabBarGap(20)).toBe(16);
    expect(tabBarGap(34)).toBe(22);
    expect(tabBarHeight(0)).toBe(80);
    expect(tabBarHeight(34)).toBe(86);
  });

  it('leaves content the pill, the raised Log button and a 16 gap of clearance', () => {
    expect(tabBarClearance(0)).toBe(116);
    expect(tabBarClearance(34)).toBe(122);
  });

  it('says where each button sits, for the app tour to spotlight: the four tabs either side of Log', () => {
    const screen = { width: 402, height: 874 };
    // The pill is 344 wide and centred: 29 in from each side, then 8 of padding. The pill's top is 80 above the bottom.
    const top = 874 - 80 + 8;
    expect(tabTargetRect('today', screen, 0)).toEqual({ x: 37, y: top, width: 64, height: 48 });
    expect(tabTargetRect('history', screen, 0)).toMatchObject({ x: 101 });
    // Log's slot (72 wide) sits between History and Profile.
    expect(tabTargetRect('profile', screen, 0)).toMatchObject({ x: 237 });
    expect(tabTargetRect('settings', screen, 0)).toMatchObject({ x: 301 });
  });

  it('puts the Log button’s ring in the middle of the screen, with its centre 13 below the pill’s top', () => {
    const screen = { width: 402, height: 874 };
    const log = tabTargetRect('log', screen, 0);
    expect(log.width).toBe(66);
    expect(log.x + log.width / 2).toBe(201);
    expect(log.y + log.height / 2).toBe(874 - 80 + 13);
  });

  it('moves the tab targets up with the home indicator, as the bar does', () => {
    const screen = { width: 402, height: 874 };
    expect(tabTargetRect('today', screen, 0).y - tabTargetRect('today', screen, 34).y).toBe(
      tabBarGap(34) - tabBarGap(0),
    );
  });
});

describe('TopBar', () => {
  it('shows a centered title and a back button that calls onBack', async () => {
    const onBack = jest.fn();
    await render(<TopBar title="Settings" onBack={onBack} />);

    expect(screen.getByRole('header', { name: 'Settings' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('can hide the back button for a tab root', async () => {
    await render(<TopBar title="History" hideBack />);

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });
});

describe('ActionMenu', () => {
  it('lists its actions and calls the one tapped', async () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    await render(
      <ActionMenu
        items={[
          { label: 'Edit entry', icon: Pencil, onPress: onEdit },
          { label: 'Delete entry', icon: Trash, onPress: onDelete, destructive: true },
        ]}
      />,
    );

    await fireEvent.press(screen.getByRole('menuitem', { name: 'Delete entry' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByText('Delete entry')).toHaveStyle({ color: lightColors.redInk });
    expect(screen.getByText('Edit entry')).toHaveStyle({ color: lightColors.ink });
  });
});
