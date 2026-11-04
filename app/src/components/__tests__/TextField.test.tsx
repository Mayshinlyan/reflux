import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { lightColors } from '@/theme';

import { TextField } from '../TextField';

const box = () => screen.getByLabelText('Notes').parent!;

describe('TextField', () => {
  it('wears the soft edge by default', async () => {
    await render(<TextField label="Notes" value="" onChangeText={() => undefined} />);

    expect(StyleSheet.flatten(box().props.style).borderColor).toBe(lightColors.edge);
  });

  it('in a list of rows (card) wears the soft row edge, and the focus ring replaces it', async () => {
    await render(<TextField label="Notes" value="" onChangeText={() => undefined} card />);

    expect(StyleSheet.flatten(box().props.style).borderColor).toBe(lightColors.edge);

    await fireEvent(screen.getByLabelText('Notes'), 'focus');

    expect(StyleSheet.flatten(box().props.style).borderColor).toBe(lightColors.clay);
  });
});
