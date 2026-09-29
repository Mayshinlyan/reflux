import { fireEvent, render, screen } from '@testing-library/react-native';

import { SymptomChip } from '../SymptomChip';

describe('SymptomChip', () => {
  it('is a checkbox that reports its state and toggles when tapped', async () => {
    const onToggle = jest.fn();
    const view = await render(<SymptomChip label="Heartburn" selected={false} onToggle={onToggle} />);

    const chip = screen.getByRole('checkbox', { name: 'Heartburn' });
    expect(chip.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(chip);
    expect(onToggle).toHaveBeenCalledTimes(1);

    await view.rerender(<SymptomChip label="Heartburn" selected onToggle={onToggle} />);
    expect(screen.getByRole('checkbox', { name: 'Heartburn' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
  });

  it('has no severity control: only its label is shown', async () => {
    await render(<SymptomChip label="Heartburn" selected onToggle={jest.fn()} />);
    expect(screen.queryByRole('adjustable')).toBeNull();
    expect(screen.getByText('Heartburn')).toBeTruthy();
  });

  it('reads as plain text when read-only and ignores presses', async () => {
    const onToggle = jest.fn();
    await render(<SymptomChip label="Heartburn" selected readOnly onToggle={onToggle} />);

    expect(screen.queryByRole('checkbox')).toBeNull();
    await fireEvent.press(screen.getByText('Heartburn'));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
