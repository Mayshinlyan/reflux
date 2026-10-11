import { fireEvent, render, screen } from '@testing-library/react-native';

import LogChooseScreen from '@/app/log/index';
import { lightColors } from '@/theme';

let mockParams: { date?: string } = {};
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  router: {
    replace: (href: unknown) => mockReplace(href),
    back: () => mockBack(),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => mockParams,
}));

beforeEach(() => {
  mockParams = {};
  mockReplace.mockClear();
  mockBack.mockClear();
});

describe('Log: choose a type', () => {
  it('shows Food, Symptoms and Medication as big tiles with no subtext', async () => {
    await render(<LogChooseScreen />);

    expect(screen.getByRole('header', { name: 'What would you like to log?' })).toBeTruthy();
    for (const name of ['Food', 'Symptoms', 'Medication']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(
      screen.queryByText(/photo or a quick description|how you're feeling|dose you've taken/i),
    ).toBeNull();
  });

  it('opens each flow in place of this screen', async () => {
    await render(<LogChooseScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Food' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Symptoms' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Medication' }));

    expect(mockReplace.mock.calls).toEqual([['/log/food'], ['/log/symptoms'], ['/log/medication']]);
  });

  it('hands a day from the week strip on to every flow', async () => {
    mockParams = { date: '2026-10-08' };
    await render(<LogChooseScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Symptoms' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Food' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Medication' }));

    expect(mockReplace.mock.calls).toEqual([
      [{ pathname: '/log/symptoms', params: { date: '2026-10-08' } }],
      [{ pathname: '/log/food', params: { date: '2026-10-08' } }],
      [{ pathname: '/log/medication', params: { date: '2026-10-08' } }],
    ]);
  });

  it('tints each tile and closes with the X', async () => {
    await render(<LogChooseScreen />);

    expect(screen.getByRole('button', { name: 'Food' })).toHaveStyle({
      backgroundColor: lightColors.honeyTint,
    });
    expect(screen.getByRole('button', { name: 'Symptoms' })).toHaveStyle({
      backgroundColor: lightColors.clayTint,
    });
    expect(screen.getByRole('button', { name: 'Medication' })).toHaveStyle({
      backgroundColor: lightColors.sageTint,
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
