import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { QuickLogArch } from '../QuickLogArch';

const arch = (open: boolean, onClosed: () => void, onPick = jest.fn()) => (
  <QuickLogArch bottomInset={0} open={open} onPick={onPick} onClose={jest.fn()} onClosed={onClosed} />
);

// Jest never applies the animated opacity, so the buttons read as hidden until they are asked for as hidden.
const food = () => screen.getByRole('button', { name: 'Food', hidden: true });

describe('QuickLogArch', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('fans out food, symptom and medication', async () => {
    await render(arch(true, jest.fn()));

    for (const name of ['Food', 'How I feel', 'Medication']) {
      expect(screen.getByRole('button', { name, hidden: true })).toBeTruthy();
    }
  });

  it('stays mounted while it closes, and says so once it has folded away', async () => {
    const onClosed = jest.fn();
    const { rerender } = await render(arch(true, onClosed));
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(onClosed).not.toHaveBeenCalled();

    await rerender(arch(false, onClosed));
    expect(food()).toBeTruthy();
    expect(onClosed).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('reverses when reopened part-way through closing, without ever reporting a close', async () => {
    const onClosed = jest.fn();
    const { rerender } = await render(arch(true, onClosed));
    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    await rerender(arch(false, onClosed));
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    await rerender(arch(true, onClosed));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(onClosed).not.toHaveBeenCalled();
    expect(food()).toBeTruthy();
  });

  it('lets touches through to the screen while it closes', async () => {
    const { rerender, root } = await render(arch(true, jest.fn()));
    expect(root?.props.pointerEvents).toBe('auto');

    await rerender(arch(false, jest.fn()));

    expect(root?.props.pointerEvents).toBe('none');
  });

  it('picks the button that is tapped', async () => {
    const onPick = jest.fn();
    await render(arch(true, jest.fn(), onPick));

    await fireEvent.press(food());

    expect(onPick).toHaveBeenCalledWith('food');
  });
});
