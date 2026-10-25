import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';

import { SymptomPromptSheet } from '../SymptomPromptSheet';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

/** A parent that closes the sheet the way the screens do, so `onDismissed` can run. */
function Harness({ onLog, onSkip }: { onLog: () => void; onSkip: () => void }) {
  const [visible, setVisible] = useState(true);
  return (
    <SymptomPromptSheet
      visible={visible}
      subtitle="Lunch logged"
      onHide={() => setVisible(false)}
      onLog={onLog}
      onSkip={onSkip}
    />
  );
}

describe('SymptomPromptSheet', () => {
  it('asks about symptoms and names what was logged', async () => {
    await render(<Harness onLog={jest.fn()} onSkip={jest.fn()} />);

    expect(screen.getByText('Any symptoms?')).toBeTruthy();
    expect(screen.getByText('Lunch logged')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log symptoms' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy();
  });

  it('closes when either answer is tapped', async () => {
    await render(<Harness onLog={jest.fn()} onSkip={jest.fn()} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));

    // The sheet slides away first, then its content goes.
    await waitFor(() => expect(screen.queryByText('Any symptoms?')).toBeNull());
  });
});
