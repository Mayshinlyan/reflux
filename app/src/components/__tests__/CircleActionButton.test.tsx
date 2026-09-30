import { fireEvent, render, screen } from '@testing-library/react-native';
import { Plus } from 'lucide-react-native';

import { CircleActionButton } from '../CircleActionButton';

describe('CircleActionButton', () => {
  it('shows its label and is an accessible button', async () => {
    const onPress = jest.fn();
    await render(<CircleActionButton variant="primary" label="Log" icon={Plus} onPress={onPress} />);

    expect(screen.getByText('Log')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('has a large version for screens where the buttons are the main choice', async () => {
    const onPress = jest.fn();
    await render(
      <CircleActionButton large variant="primary" label="Take a photo" icon={Plus} onPress={onPress} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('action-circle')).toHaveStyle({ width: 76, height: 76 });
  });
});
