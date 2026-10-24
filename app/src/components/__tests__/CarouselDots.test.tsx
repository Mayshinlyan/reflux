import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { CarouselDots } from '../CarouselDots';

describe('CarouselDots', () => {
  it('tells a screen reader which card is in view', async () => {
    await render(<CarouselDots page={2} total={4} />);

    const dots = screen.getByLabelText('Card 2 of 4');
    expect(dots.props.accessibilityRole).toBe('adjustable');
    expect(dots.props.accessibilityValue).toEqual({ min: 1, max: 4, now: 2 });
  });

  it('draws one dot per card, and only shows where you are without onSelect', async () => {
    await render(<CarouselDots page={1} total={3} />);

    expect(screen.getByLabelText('Card 1 of 3').props.accessibilityActions).toBeUndefined();
    expect(screen.getByLabelText('Card 1 of 3').children).toHaveLength(3);
  });

  it('makes the card in view a wider pill, and the others small round dots', async () => {
    await render(<CarouselDots page={2} total={3} />);

    const width = (testID: string) => StyleSheet.flatten(screen.getAllByTestId(testID)[0].props.style).width;
    expect(screen.getAllByTestId('dot')).toHaveLength(2);
    expect(screen.getAllByTestId('dot-active')).toHaveLength(1);
    expect(width('dot')).toBe(8);
    expect(width('dot-active')).toBe(20);
  });

  it('goes to the card whose dot is tapped', async () => {
    const onSelect = jest.fn();
    await render(<CarouselDots page={1} total={3} onSelect={onSelect} />);

    const dots = screen.getByLabelText('Card 1 of 3');
    await fireEvent.press(dots.children[2] as never);

    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it('can be adjusted up and down by a screen reader, and stops at the ends', async () => {
    const onSelect = jest.fn();
    await render(<CarouselDots page={1} total={3} onSelect={onSelect} />);
    const dots = screen.getByLabelText('Card 1 of 3');

    await fireEvent(dots, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onSelect).toHaveBeenLastCalledWith(2);
    await fireEvent(dots, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onSelect).toHaveBeenLastCalledWith(1); // already the first
  });
});
