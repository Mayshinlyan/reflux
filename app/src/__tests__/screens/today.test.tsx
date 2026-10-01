import { fireEvent, render, screen } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import TodayScreen from '@/app/index';

const mockPush = jest.fn();

jest.mock('@/db/DatabaseProvider', () => ({
  useSettings: () => ({ settings: { petName: 'Mochi', petAnimal: 'mochi', onboardingDone: true } }),
}));
jest.mock('@/hooks/usePetState', () => ({
  usePetState: () => ({
    stage: 0,
    progress: 10,
    mood: 'happy',
    hasLogs: false,
    stageUp: false,
    markStageSeen: jest.fn(),
  }),
}));
// Reanimated's native runtime can't load in Jest; use its mocks (which lack useReducedMotion).
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
jest.mock('@/hooks/useCoins', () => ({ useCoins: () => ({ coins: 7, gain: 0, gainId: 0 }) }));
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: jest.fn(), seekTo: jest.fn() }),
  setAudioModeAsync: () => Promise.resolve(),
}));
// The real pet animates with Reanimated and video; not needed to test navigation.
jest.mock('@/components/Pet', () => ({ Pet: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  router: { push: (href: unknown) => mockPush(href) },
  Redirect: () => null,
}));

const swipe = (translationX: number, translationY = 0, velocityX = 0, velocityY = 0) =>
  fireGestureHandler(getByGestureTestId('swipe-nav'), [
    { state: State.BEGAN, translationX: 0, translationY: 0, velocityX: 0, velocityY: 0 },
    {
      state: State.ACTIVE,
      translationX: translationX / 2,
      translationY: translationY / 2,
      velocityX,
      velocityY,
    },
    { state: State.END, translationX, translationY, velocityX, velocityY },
  ]);

beforeEach(() => mockPush.mockClear());

describe('Today: swipe to move around', () => {
  it('opens Your Logs after a long enough left swipe', async () => {
    await render(<TodayScreen />);
    expect(screen.getByText('Mochi')).toBeTruthy();

    swipe(-120);

    expect(mockPush).toHaveBeenCalledWith('/history');
  });

  it('opens Your Logs on a short but fast left flick', async () => {
    await render(<TodayScreen />);
    swipe(-30, 0, -900);
    expect(mockPush).toHaveBeenCalledWith('/history');
  });

  it('opens the profile after a long enough right swipe', async () => {
    await render(<TodayScreen />);
    swipe(120);
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('opens the profile on a short but fast right flick', async () => {
    await render(<TodayScreen />);
    swipe(30, 0, 900);
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('ignores a short, slow drag and a swipe up', async () => {
    await render(<TodayScreen />);
    swipe(-30, 0, -100);
    swipe(0, -120);
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('Today: buttons', () => {
  it('has no Your Logs button; Scan, Log and the profile remain', async () => {
    await render(<TodayScreen />);
    expect(screen.queryByRole('button', { name: 'Your Logs' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Log' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Scan' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Settings' }));
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });
});

describe('Today: coins', () => {
  it('shows the coin balance in the header', async () => {
    await render(<TodayScreen />);
    expect(screen.getByLabelText('7 coins')).toBeTruthy();
  });
});
