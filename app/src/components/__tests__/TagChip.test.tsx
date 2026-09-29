import { fireEvent, render, screen } from '@testing-library/react-native';

import { TagChip } from '../TagChip';

describe('TagChip', () => {
  it('shows a labelled minus button when it can be removed, and the label stays readable', async () => {
    const onRemove = jest.fn();
    await render(<TagChip label="Stress" selected readOnly onRemove={onRemove} />);

    expect(screen.getByText('Stress')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Stress' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('has no minus button unless asked to', async () => {
    await render(<TagChip label="Stress" selected readOnly />);
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
  });

  it('still works as a normal toggle when there is no minus', async () => {
    const onPress = jest.fn();
    await render(<TagChip label="Stress" selected={false} onPress={onPress} />);

    const chip = screen.getByRole('checkbox', { name: 'Stress' });
    expect(chip.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
