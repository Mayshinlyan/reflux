import { fireEvent, render, screen } from '@testing-library/react-native';
import { Compass } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { lightColors } from '@/theme';

import { ChoiceCard } from '../ChoiceCard';
import { OptionRow } from '../OptionRow';
import { TextField } from '../TextField';

const flat = (node: { props: { style?: unknown } }) =>
  StyleSheet.flatten(
    typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style,
  );

describe('soft edges: the 1px edge every box has', () => {
  it('a text field wears it, and focusing swaps it for the clay ring', async () => {
    await render(<TextField label="Notes" value="" onChangeText={() => undefined} />);
    const box = () => screen.getByLabelText('Notes').parent!;

    expect(StyleSheet.flatten(box().props.style).borderColor).toBe(lightColors.edge);

    await fireEvent(screen.getByLabelText('Notes'), 'focus');

    expect(StyleSheet.flatten(box().props.style).borderColor).toBe(lightColors.clay);
  });

  it('an option row wears it until it is chosen, then the olive outline', async () => {
    const { rerender } = await render(
      <OptionRow label="Weekly" selected={false} onPress={() => undefined} />,
    );

    expect(flat(screen.getByRole('radio', { name: 'Weekly' })).borderColor).toBe(lightColors.edge);

    await rerender(<OptionRow label="Weekly" selected onPress={() => undefined} />);

    expect(flat(screen.getByRole('radio', { name: 'Weekly' })).borderColor).toBe(lightColors.sageInk);
  });

  it('a choice card wears it until it is chosen, then the olive outline', async () => {
    const { rerender } = await render(
      <ChoiceCard title="Describe it" icon={Compass} selected={false} onPress={() => undefined} />,
    );

    expect(flat(screen.getByRole('radio', { name: 'Describe it' })).borderColor).toBe(lightColors.edge);

    await rerender(<ChoiceCard title="Describe it" icon={Compass} selected onPress={() => undefined} />);

    expect(flat(screen.getByRole('radio', { name: 'Describe it' })).borderColor).toBe(lightColors.sageInk);
  });
});
