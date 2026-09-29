import { fireEvent, render, screen } from '@testing-library/react-native';

import { SymptomChip } from '../SymptomChip';

describe('SymptomChip', () => {
  it('toggles when tapped and reports its checked state', async () => {
    const onToggle = jest.fn();
    await render(<SymptomChip label="Heartburn" onToggle={onToggle} />);

    const chip = screen.getByRole('checkbox', { name: 'Heartburn' });
    expect(chip.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(chip);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('lets screen readers adjust severity within 1–5 once selected', async () => {
    const onScoreChange = jest.fn();
    await render(
      <SymptomChip label="Heartburn" score={5} onToggle={jest.fn()} onScoreChange={onScoreChange} />,
    );

    const chip = screen.getByRole('adjustable', { name: 'Heartburn' });
    expect(chip.props.accessibilityValue).toEqual({ text: 'severity 5 of 5' });

    await fireEvent(chip, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    await fireEvent(chip, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });

    expect(onScoreChange.mock.calls).toEqual([[5], [4]]);
  });
});
