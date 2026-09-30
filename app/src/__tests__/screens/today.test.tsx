import { render, screen } from '@testing-library/react-native';
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

const swipe = (translationX: number, velocityX = 0) =>
  fireGestureHandler(getByGestureTestId('swipe-to-history'), [
    { state: State.BEGAN, translationX: 0, velocityX: 0 },
    { state: State.ACTIVE, translationX: translationX / 2, velocityX },
    { state: State.END, translationX, velocityX },
  ]);

beforeEach(() => mockPush.mockClear());

describe('Today: swipe left for History', () => {
  it('opens History after a long enough left swipe', async () => {
    await render(<TodayScreen />);
    expect(screen.getByText('Mochi')).toBeTruthy();

    swipe(-120);

    expect(mockPush).toHaveBeenCalledWith('/history');
  });

  it('opens History on a short but fast flick', async () => {
    await render(<TodayScreen />);
    swipe(-30, -900);
    expect(mockPush).toHaveBeenCalledWith('/history');
  });

  it('ignores a short, slow drag', async () => {
    await render(<TodayScreen />);
    swipe(-30, -100);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
