import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pencil, Trash } from 'lucide-react-native';

import { lightColors } from '@/theme';

import { ActionMenu } from '../ActionMenu';
import { FloatingTabBar, tabBarBottomPadding, tabBarHeight } from '../FloatingTabBar';
import { TopBar } from '../TopBar';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));

describe('FloatingTabBar', () => {
  it('has Log, Today and History, and reports the one tapped', async () => {
    const onSelect = jest.fn();
    await render(<FloatingTabBar active="today" bottomInset={0} onSelect={onSelect} />);

    for (const name of ['Log', 'Today', 'History']) {
      expect(screen.getByLabelText(name)).toBeTruthy();
    }
    expect(screen.queryByLabelText('You')).toBeNull();
    await fireEvent.press(screen.getByLabelText('History'));
    await fireEvent.press(screen.getByLabelText('Log'));

    expect(onSelect).toHaveBeenNthCalledWith(1, 'history');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'log');
  });

  it('marks only the current tab as selected, in ink, with no background on either tab', async () => {
    await render(<FloatingTabBar active="history" bottomInset={0} onSelect={jest.fn()} />);

    expect(screen.getByRole('tab', { name: 'History' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByRole('tab', { name: 'Today' }).props.accessibilityState).toMatchObject({
      selected: false,
    });
    for (const name of ['Today', 'History']) {
      expect(screen.getByRole('tab', { name })).not.toHaveStyle({ backgroundColor: lightColors.surface2 });
    }
  });

  it('draws the selected tab solid ink and the other a pale surface2 silhouette, with details cut out', async () => {
    // react-native-svg hands colours to the native view as opaque ARGB numbers.
    const argb = (hex: string) => String(parseInt(`FF${hex.slice(1)}`, 16));
    await render(<FloatingTabBar active="history" bottomInset={0} onSelect={jest.fn()} />);

    const today = JSON.stringify(screen.getByRole('tab', { name: 'Today' }));
    const history = JSON.stringify(screen.getByRole('tab', { name: 'History' }));

    expect(today).toContain(argb(lightColors.surface2));
    expect(today).not.toContain(argb(lightColors.ink));
    expect(history).toContain(argb(lightColors.ink));
    expect(history).not.toContain(argb(lightColors.surface2));
    for (const tab of [today, history]) expect(tab).toContain(argb(lightColors.surface));
  });

  it('keeps Log outside the tabs: two tabs, with Log as a separate button', async () => {
    await render(<FloatingTabBar active="today" bottomInset={0} onSelect={jest.fn()} />);

    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Today',
      'History',
    ]);
    expect(screen.queryByRole('tab', { name: 'Log' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Log' })).toBeTruthy();
  });

  it('keeps Log as the olive primary action whichever tab is current', async () => {
    await render(<FloatingTabBar active="history" bottomInset={0} onSelect={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Log' })).toHaveStyle({ backgroundColor: lightColors.cta });
  });

  it('turns Log into Close, reported as expanded, while the arch is open', async () => {
    await render(<FloatingTabBar active="today" logOpen bottomInset={0} onSelect={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Log' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Close' }).props.accessibilityState).toMatchObject({
      expanded: true,
    });
  });

  it('is 64 tall on a phone without a home indicator, and grows with the indicator inset', () => {
    expect(tabBarHeight(0)).toBe(64);
    expect(tabBarHeight(34)).toBe(78);
    expect(tabBarBottomPadding(10)).toBe(8);
    expect(tabBarBottomPadding(34)).toBe(22);
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
