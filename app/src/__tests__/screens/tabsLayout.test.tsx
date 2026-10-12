import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import TabsLayout from '@/app/(tabs)/_layout';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
let mockActiveRoute = 'index';

jest.mock('expo-router', () => ({ router: { push: (href: unknown) => mockPush(href) } }));
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

    for (const name of ['Snap food', 'Symptom', 'Medication']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('opens the camera for Snap food, then closes', async () => {
    await render(<TabsLayout />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Snap food' }));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/log/food', params: { camera: '1' } });
    expect(screen.queryByRole('button', { name: 'Symptom' })).toBeNull();
  });

  it('opens the symptom and medication flows', async () => {
    await render(<TabsLayout />);

    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Symptom' }));
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
