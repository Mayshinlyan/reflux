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
});
