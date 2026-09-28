import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '../Button';

describe('Button', () => {
  it('is an accessible button that calls onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Get started" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} disabled />);

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(onPress).not.toHaveBeenCalled();
  });
});
