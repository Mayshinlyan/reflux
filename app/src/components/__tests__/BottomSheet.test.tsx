import { act, render } from '@testing-library/react-native';
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
