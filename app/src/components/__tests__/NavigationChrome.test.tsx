import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pencil, Trash } from 'lucide-react-native';

import { lightColors } from '@/theme';

import { ActionMenu } from '../ActionMenu';
import { FloatingTabBar } from '../FloatingTabBar';
import { TopBar } from '../TopBar';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));

describe('FloatingTabBar', () => {
  it('has Log, Today, History and You, and reports the one tapped', async () => {
    const onSelect = jest.fn();
    await render(<FloatingTabBar active="today" onSelect={onSelect} />);

    for (const name of ['Log', 'Today', 'History', 'You']) {
      expect(screen.getByLabelText(name)).toBeTruthy();
    }
    await fireEvent.press(screen.getByLabelText('History'));
    await fireEvent.press(screen.getByLabelText('Log'));

    expect(onSelect).toHaveBeenNthCalledWith(1, 'history');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'log');
  });

  it('marks only the current tab as selected, on a surface2 fill', async () => {
    await render(<FloatingTabBar active="you" onSelect={jest.fn()} />);

    expect(screen.getByRole('tab', { name: 'You' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByRole('tab', { name: 'Today' }).props.accessibilityState).toMatchObject({
      selected: false,
    });
    expect(screen.getByRole('tab', { name: 'You' })).toHaveStyle({ backgroundColor: lightColors.surface2 });
  });

  it('keeps Log as the olive primary action whichever tab is current', async () => {
    await render(<FloatingTabBar active="history" onSelect={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Log' })).toHaveStyle({ backgroundColor: lightColors.cta });
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
