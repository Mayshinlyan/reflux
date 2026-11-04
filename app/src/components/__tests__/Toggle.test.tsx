import { fireEvent, render, screen } from '@testing-library/react-native';

import { Toggle } from '../Toggle';

describe('Toggle', () => {
  it('is a switch that reports whether it is on', async () => {
    await render(<Toggle accessibilityLabel="Use my fridge" value onValueChange={() => undefined} />);

    expect(screen.getByRole('switch', { name: 'Use my fridge' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
  });

  it('hands over the opposite value when pressed', async () => {
    const onValueChange = jest.fn();
    await render(<Toggle accessibilityLabel="Use my fridge" value={false} onValueChange={onValueChange} />);

    await fireEvent.press(screen.getByRole('switch', { name: 'Use my fridge' }));

    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('ignores presses when disabled', async () => {
    const onValueChange = jest.fn();
    await render(
      <Toggle accessibilityLabel="Use my fridge" value={false} onValueChange={onValueChange} disabled />,
    );

    await fireEvent.press(screen.getByRole('switch', { name: 'Use my fridge' }));

    expect(onValueChange).not.toHaveBeenCalled();
  });
});
