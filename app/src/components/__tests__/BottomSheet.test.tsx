import { act, fireEvent, render } from '@testing-library/react-native';
import { Platform, ScrollView, Text } from 'react-native';

import { BottomSheet } from '../BottomSheet';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const sheet = (visible: boolean, onDismissed: () => void) => (
  <BottomSheet visible={visible} onClose={jest.fn()} onDismissed={onDismissed}>
    <Text>content</Text>
  </BottomSheet>
);

describe('BottomSheet onDismissed on Android', () => {
  const originalOS = Platform.OS;
  beforeEach(() => {
    jest.useFakeTimers();
    Platform.OS = 'android';
  });
  afterEach(() => {
    jest.useRealTimers();
    Platform.OS = originalOS;
  });

  it('fires once after the slide-out, even if the parent re-renders with a new callback meanwhile', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const screen = await render(sheet(true, first));

    await screen.rerender(sheet(false, first)); // sheet closes; timer starts
    await screen.rerender(sheet(false, second)); // parent re-renders with a new function identity
    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('does not fire while the sheet is open or on the first render', async () => {
    const onDismissed = jest.fn();
    const screen = await render(sheet(false, onDismissed));
    await screen.rerender(sheet(true, onDismissed));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(onDismissed).not.toHaveBeenCalled();
  });
});

describe('BottomSheet closing', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('keeps its content while it slides away, then drops it', async () => {
    const screen = await render(sheet(true, jest.fn()));

    await screen.rerender(sheet(false, jest.fn()));
    expect(screen.getByText('content')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(screen.queryByText('content')).toBeNull();
  });

  it('stays open when it is reopened while it is still sliding away', async () => {
    const screen = await render(sheet(true, jest.fn()));

    await screen.rerender(sheet(false, jest.fn()));
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    await screen.rerender(sheet(true, jest.fn()));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText('content')).toBeTruthy();
  });

  it('closes from the scrim, and tells the parent rather than hiding itself', async () => {
    const onClose = jest.fn();
    const screen = await render(
      <BottomSheet visible onClose={onClose}>
        <Text>content</Text>
      </BottomSheet>,
    );

    // The scrim fades in with the sheet, and Jest never applies the animated opacity, so it still reads as hidden.
    await fireEvent.press(screen.getByRole('button', { name: 'Close', hidden: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText('content')).toBeTruthy();
  });
});

describe('BottomSheet scrollToTopKey', () => {
  const withKey = (key: boolean) => (
    <BottomSheet visible onClose={jest.fn()} scrollToTopKey={key}>
      <Text>content</Text>
    </BottomSheet>
  );

  it('scrolls back to the top when the key changes, not on re-renders that keep it', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
    const screen = await render(withKey(false));
    scrollTo.mockClear();

    await screen.rerender(withKey(false));
    expect(scrollTo).not.toHaveBeenCalled();

    await screen.rerender(withKey(true));
    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
    scrollTo.mockRestore();
  });
});
