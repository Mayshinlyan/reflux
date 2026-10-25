import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { minTouchTarget } from '@/theme';

import { SegmentedControl } from '../SegmentedControl';

const OPTIONS = [
  { value: 'cards', label: 'Cards' },
  { value: 'list', label: 'List' },
] as const;

describe('SegmentedControl', () => {
  it('gives every option at least the minimum touch target', async () => {
    await render(<SegmentedControl options={OPTIONS} value="cards" onChange={jest.fn()} />);
    for (const label of ['Cards', 'List']) {
      const style = StyleSheet.flatten(screen.getByLabelText(label).props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(minTouchTarget);
    }
  });

  it('reports the chosen option', async () => {
    const onChange = jest.fn();
    await render(<SegmentedControl options={OPTIONS} value="cards" onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('List'));
    expect(onChange).toHaveBeenCalledWith('list');
  });
});
