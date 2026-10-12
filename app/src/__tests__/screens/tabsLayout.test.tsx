import { fireEvent, render, screen } from '@testing-library/react-native';

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

  it('treats Profile as the You tab', async () => {
    mockActiveRoute = 'profile';
    await render(<TabsLayout />);

    expect(screen.getByRole('tab', { name: 'You' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('opens the Log chooser from the Log button without changing tabs', async () => {
    await render(<TabsLayout />);

    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    expect(mockPush).toHaveBeenCalledWith('/log');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('switches to the tab that is tapped, and ignores a tap on the current one', async () => {
    await render(<TabsLayout />);

    await fireEvent.press(screen.getByRole('tab', { name: 'History' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'You' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Today' }));

    expect(mockNavigate.mock.calls).toEqual([['history'], ['profile']]);
  });
});
