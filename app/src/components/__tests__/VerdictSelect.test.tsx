import { fireEvent, render, screen } from '@testing-library/react-native';

import { VerdictSelect } from '../VerdictSelect';

describe('VerdictSelect', () => {
  it('is one row until tapped, then lists the four choices in its place', async () => {
    await render(<VerdictSelect value="caution" onChange={jest.fn()} />);
    expect(screen.queryByRole('radio')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Verdict, Caution' }));
    expect(screen.queryByRole('button', { name: 'Verdict, Caution' })).toBeNull(); // not shown twice
    expect(screen.getAllByRole('radio').map((option) => option.props.accessibilityLabel)).toEqual([
      'OK',
      'Likely OK',
      'Caution',
      'Likely trigger',
    ]);
    expect(screen.getByRole('radio', { name: 'Caution' }).props.accessibilityState).toEqual({
      checked: true,
    });
  });

  it('reports the choice and closes', async () => {
    const onChange = jest.fn();
    await render(<VerdictSelect value="caution" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Verdict, Caution' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'OK' }));

    expect(onChange).toHaveBeenCalledWith('good');
    expect(screen.queryByRole('radio')).toBeNull();
  });
});
