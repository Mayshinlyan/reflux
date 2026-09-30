import { act, render, screen } from '@testing-library/react-native';

import { LOADING_STEP_MS } from '@/lib/loadingMessages';

import { FoodLoading } from '../FoodLoading';

// The libraries' own jest mocks: animations become no-ops, so the test checks the words and behaviour.
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
let mockReduceMotion = false;
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => mockReduceMotion,
}));
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock('expo-image', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { Image: () => <View testID="preview" /> };
});

beforeEach(() => {
  mockReduceMotion = false;
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('FoodLoading', () => {
  it('announces what it is doing, as a polite live region', async () => {
    await render(<FoodLoading source="text" />);

    const region = screen.getByLabelText('Looking at your food…');
    expect(region.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.getByText('Looking at your food…')).toBeTruthy();
  });

  it('changes its message over time and settles on "Almost there…"', async () => {
    await render(<FoodLoading source="text" />);

    await act(async () => {
      jest.advanceTimersByTime(LOADING_STEP_MS);
    });
    expect(screen.getByText('Checking for reflux triggers…')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(LOADING_STEP_MS * 10);
    });
    expect(screen.getByText('Almost there…')).toBeTruthy();
  });

  it('shows a small preview while a photo is being looked at', async () => {
    await render(<FoodLoading source="photo" photoUri="file:///meal.jpg" />);

    expect(screen.getByTestId('preview')).toBeTruthy();
    expect(screen.getByText('Looking at your photo…')).toBeTruthy();
  });

  it('shows no preview for typed food', async () => {
    await render(<FoodLoading source="text" />);

    expect(screen.queryByTestId('preview')).toBeNull();
  });

  it('still shows the words, and keeps changing them, when reduced motion is on', async () => {
    mockReduceMotion = true;
    await render(<FoodLoading source="text" />);
    expect(screen.getByText('Looking at your food…')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(LOADING_STEP_MS);
    });

    expect(screen.getByText('Checking for reflux triggers…')).toBeTruthy();
  });

  it('stops its timer when it goes away', async () => {
    const setSpy = jest.spyOn(global, 'setInterval');
    const clearSpy = jest.spyOn(global, 'clearInterval');
    const view = await render(<FoodLoading source="text" />);
    const index = setSpy.mock.calls.findIndex(([, ms]) => ms === LOADING_STEP_MS);
    expect(index).toBeGreaterThanOrEqual(0);
    const timerId = setSpy.mock.results[index]?.value;

    await view.unmount();

    expect(clearSpy).toHaveBeenCalledWith(timerId);
    setSpy.mockRestore();
    clearSpy.mockRestore();
  });
});
