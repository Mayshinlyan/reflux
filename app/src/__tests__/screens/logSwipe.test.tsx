import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { SwipeNav } from '@/components/SwipeNav';
import { foodSwipe, medicationSwipe, symptomsSwipe } from '@/lib/logSwipe';

const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockCanGoBack = true;

jest.mock('expo-router', () => ({
  router: {
    replace: (href: unknown) => mockReplace(href),
    back: () => mockBack(),
    canGoBack: () => mockCanGoBack,
  },
}));

const swipe = (translationX: number) =>
  fireGestureHandler(getByGestureTestId('swipe-nav'), [
    { state: State.BEGAN, translationX: 0, translationY: 0, velocityX: 0, velocityY: 0 },
    { state: State.ACTIVE, translationX: translationX / 2, translationY: 0, velocityX: 0, velocityY: 0 },
    { state: State.END, translationX, translationY: 0, velocityX: 0, velocityY: 0 },
  ]);

beforeEach(() => {
  mockReplace.mockClear();
  mockBack.mockClear();
  mockCanGoBack = true;
});

describe('swipe between the log screens', () => {
  it('goes Food → Symptoms on a left swipe and back on a right swipe', async () => {
    await render(
      <SwipeNav {...foodSwipe}>
        <Text>Food</Text>
      </SwipeNav>,
    );
    swipe(-120);
    expect(mockReplace).toHaveBeenCalledWith('/log/symptoms');
    swipe(120);
    expect(mockBack).toHaveBeenCalled();
  });

  it('goes to Today from Food when there is nothing to go back to', async () => {
    mockCanGoBack = false;
    await render(
      <SwipeNav {...foodSwipe}>
        <Text>Food</Text>
      </SwipeNav>,
    );
    swipe(120);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('goes Symptoms → Medication forward and → Food back', async () => {
    await render(
      <SwipeNav {...symptomsSwipe}>
        <Text>Symptoms</Text>
      </SwipeNav>,
    );
    swipe(-120);
    expect(mockReplace).toHaveBeenLastCalledWith('/log/medication');
    swipe(120);
    expect(mockReplace).toHaveBeenLastCalledWith('/log/food');
  });

  it('goes Medication → Symptoms on a right swipe and has nowhere further on', async () => {
    await render(
      <SwipeNav {...medicationSwipe}>
        <Text>Medication</Text>
      </SwipeNav>,
    );
    swipe(-120);
    expect(mockReplace).not.toHaveBeenCalled();
    swipe(120);
    expect(mockReplace).toHaveBeenCalledWith('/log/symptoms');
  });

  it('does nothing while disabled', async () => {
    await render(
      <SwipeNav {...symptomsSwipe} enabled={false}>
        <Text>Symptoms</Text>
      </SwipeNav>,
    );
    swipe(-120);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
