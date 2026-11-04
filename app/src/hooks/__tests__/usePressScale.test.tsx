import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';

import { Button } from '@/components/Button';

import { PRESSED_SCALE, usePressScale } from '../usePressScale';

describe('usePressScale', () => {
  it('is set to grow 10%, and a button using it still presses normally', async () => {
    expect(PRESSED_SCALE).toBeCloseTo(1.1, 5);

    const onPress = jest.fn();
    await render(<Button label="Get ideas" onPress={onPress} />);

    await fireEvent(screen.getByRole('button', { name: 'Get ideas' }), 'pressIn');
    await fireEvent.press(screen.getByRole('button', { name: 'Get ideas' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('hands back an animated style and the two press handlers', async () => {
    const { result } = await renderHook(() => usePressScale());

    await act(async () => {
      result.current.pressIn();
      result.current.pressOut();
    });

    expect(typeof result.current.pressIn).toBe('function');
    expect(typeof result.current.pressOut).toBe('function');
    expect(result.current.style).toBeDefined();
  });
});
