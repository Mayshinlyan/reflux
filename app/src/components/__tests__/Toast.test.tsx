import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { ToastProvider, useToast } from '../Toast';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// Reanimated's native runtime can't load in Jest; use its mocks (which lack useReducedMotion).
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));

const onUndo = jest.fn();

function Show({ withAction }: { withAction: boolean }) {
  const toast = useToast();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Show"
      onPress={() =>
        toast('Entry deleted', withAction ? { action: { label: 'Undo', onPress: onUndo } } : undefined)
      }>
      <Text>Show</Text>
    </Pressable>
  );
}

const show = async (withAction: boolean) => {
  await render(
    <ToastProvider>
      <Show withAction={withAction} />
    </ToastProvider>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Show' }));
};

beforeEach(() => {
  jest.useFakeTimers();
  onUndo.mockClear();
});
afterEach(() => jest.useRealTimers());

describe('Toast', () => {
  it('shows a message and goes away after a couple of seconds', async () => {
    await show(false);
    expect(screen.getByText('Entry deleted')).toBeTruthy();

    await act(async () => jest.advanceTimersByTime(2300));

    expect(screen.queryByText('Entry deleted')).toBeNull();
  });

  it('has no Undo unless asked', async () => {
    await show(false);

    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('with an action, stays long enough to tap it', async () => {
    await show(true);

    await act(async () => jest.advanceTimersByTime(2300));
    expect(screen.getByText('Entry deleted')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();

    await act(async () => jest.advanceTimersByTime(2800));
    expect(screen.queryByText('Entry deleted')).toBeNull();
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('runs the action once when tapped, and closes', async () => {
    await show(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Entry deleted')).toBeNull();
  });
});
