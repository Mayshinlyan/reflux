import { fireEvent, render, screen } from '@testing-library/react-native';

import { Select } from '../Select';

const OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'food', label: 'Food' },
] as const;

describe('Select', () => {
  it('is closed to start with, and says so', async () => {
    await render(<Select options={OPTIONS} value="all" onChange={jest.fn()} label="Show" />);
    const trigger = screen.getByLabelText('Show, All');
    expect(trigger.props.accessibilityState).toMatchObject({ expanded: false });
    expect(screen.queryByLabelText('Food')).toBeNull();
  });

  it('says it is expanded once opened', async () => {
    await render(<Select options={OPTIONS} value="all" onChange={jest.fn()} label="Show" />);
    await fireEvent.press(screen.getByLabelText('Show, All'));
    expect(screen.getByLabelText('Show').props.accessibilityState).toMatchObject({ expanded: true });
    expect(screen.getByLabelText('Food')).toBeTruthy();
  });

  it('closes and reports the choice', async () => {
    const onChange = jest.fn();
    await render(<Select options={OPTIONS} value="all" onChange={onChange} label="Show" />);
    await fireEvent.press(screen.getByLabelText('Show, All'));
    await fireEvent.press(screen.getByLabelText('Food'));
    expect(onChange).toHaveBeenCalledWith('food');
    expect(screen.queryByLabelText('Food')).toBeNull();
  });
});
