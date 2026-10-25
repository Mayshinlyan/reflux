import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { ReminderPromptSheet } from '../ReminderPromptSheet';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

/** A parent that closes the sheet the way Today does, so `onDismissed` can run. */
function Harness({ onYes, onNotNow }: { onYes: () => void; onNotNow: () => void }) {
  const [visible, setVisible] = useState(true);
  return (
    <ReminderPromptSheet
      visible={visible}
      onHide={() => setVisible(false)}
      onYes={onYes}
      onNotNow={onNotNow}
    />
  );
}

describe('ReminderPromptSheet', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('offers the nudge and says it stays on the phone', async () => {
    await render(<Harness onYes={jest.fn()} onNotNow={jest.fn()} />);

    expect(screen.getByRole('header', { name: 'Want a gentle nudge?' })).toBeTruthy();
    expect(screen.getByText(/stays on your phone/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yes please' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy();
  });

  it('closes, then runs "yes" once the sheet is away', async () => {
    const onYes = jest.fn();
    const onNotNow = jest.fn();
    await render(<Harness onYes={onYes} onNotNow={onNotNow} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Yes please' }));
    // The sheet slides away first, then its content goes.
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(screen.queryByText('Want a gentle nudge?')).toBeNull();
    expect(onYes).not.toHaveBeenCalled();

    // The close callback never comes in a test, so the backstop delivers the answer, once.
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(onYes).toHaveBeenCalledTimes(1);
    expect(onNotNow).not.toHaveBeenCalled();
  });

  it('runs "not now" for the button and for the scrim', async () => {
    const onYes = jest.fn();
    const onNotNow = jest.fn();
    await render(<Harness onYes={onYes} onNotNow={onNotNow} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(onNotNow).toHaveBeenCalledTimes(1);
    expect(onYes).not.toHaveBeenCalled();
  });
});
