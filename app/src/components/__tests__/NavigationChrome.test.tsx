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

  it('sits 24 above the home indicator inset or more, and 88 tall on a phone without one', () => {
    expect(tabBarHeight(0)).toBe(88);
    expect(tabBarHeight(34)).toBe(98);
    expect(tabBarBottomPadding(10)).toBe(24);
    expect(tabBarBottomPadding(34)).toBe(34);
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
