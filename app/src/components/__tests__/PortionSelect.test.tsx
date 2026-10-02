import { fireEvent, render, screen } from '@testing-library/react-native';

import { PortionSelect } from '../PortionSelect';

describe('PortionSelect', () => {
  it('is one row until tapped, then lists the three choices in its place', async () => {
    await render(<PortionSelect value="regular" onChange={jest.fn()} />);
    expect(screen.queryByRole('radio')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Portion, Regular' }));
    expect(screen.queryByRole('button', { name: 'Portion, Regular' })).toBeNull(); // not shown twice
    expect(screen.getAllByRole('radio').map((option) => option.props.accessibilityLabel)).toEqual([
      'Small',
      'Regular',
      'Large',
    ]);
    expect(screen.getByRole('radio', { name: 'Regular' }).props.accessibilityState).toEqual({
      checked: true,
    });
  });

  it('reports the choice and closes', async () => {
    const onChange = jest.fn();
    await render(<PortionSelect value="regular" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Portion, Regular' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Large' }));

    expect(onChange).toHaveBeenCalledWith('large');
    expect(screen.queryByRole('radio')).toBeNull();
  });
});
