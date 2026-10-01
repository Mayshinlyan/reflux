import { act, render, screen } from '@testing-library/react-native';

import { CoinCounter } from '../CoinCounter';

// Reanimated's native runtime can't load in Jest; use its mocks (which lack useReducedMotion).
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
const mockPlay = jest.fn();
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: mockPlay, seekTo: jest.fn() }),
  setAudioModeAsync: () => Promise.resolve(),
}));

beforeEach(() => {
  jest.useFakeTimers();
  mockPlay.mockClear();
});
afterEach(() => jest.useRealTimers());

describe('CoinCounter', () => {
  it('shows the balance without a ching when nothing was just earned', async () => {
    await render(<CoinCounter coins={1} gain={0} gainId={0} />);
    expect(screen.getByLabelText('1 coin')).toBeTruthy();
    await act(() => jest.runAllTimers());
    expect(mockPlay).not.toHaveBeenCalled();
    expect(screen.queryByText('+1')).toBeNull();
  });

  it('chings and pops "+N" once for each new gain', async () => {
    const view = await render(<CoinCounter coins={4} gain={0} gainId={0} />);

    await view.rerender(<CoinCounter coins={5} gain={1} gainId={1} />);
    expect(screen.getByText('+1')).toBeTruthy();
    await act(() => jest.runAllTimers());
    expect(mockPlay).toHaveBeenCalledTimes(1);

    // Re-rendered with the same gain (e.g. the pet state updated): no second ching.
    await view.rerender(<CoinCounter coins={5} gain={1} gainId={1} />);
    await act(() => jest.runAllTimers());
    expect(mockPlay).toHaveBeenCalledTimes(1);

    await view.rerender(<CoinCounter coins={7} gain={2} gainId={2} />);
    await act(() => jest.runAllTimers());
    expect(mockPlay).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('7 coins')).toBeTruthy();
  });
});
