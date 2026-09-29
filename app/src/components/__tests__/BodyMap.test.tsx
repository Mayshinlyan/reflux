import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { BodyMap } from '../BodyMap';

describe('BodyMap', () => {
  it('offers the three areas as buttons and reports which one was tapped', async () => {
    const onZonePress = jest.fn();
    await render(<BodyMap counts={{}} onZonePress={onZonePress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Throat & voice' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Chest' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tummy' }));

    expect(onZonePress.mock.calls).toEqual([['throat'], ['chest'], ['tummy']]);
  });

  it('says how many symptoms are chosen in an area, without listing them', async () => {
    await render(<BodyMap counts={{ chest: 2, tummy: 1 }} onZonePress={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Chest, 2 selected' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tummy, 1 selected' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Throat & voice' })).toBeTruthy();
    // The count badge is visible text.
    expect(screen.getByText('2', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('1', { includeHiddenElements: true })).toBeTruthy();
  });

  it('lets the label rows span the whole row, so their percentages have a width to work with', async () => {
    // Regression: these wrappers hold only absolutely positioned children, so without
    // left/right they compute to 0 wide (checked with Yoga) and every label collapses to x=0.
    await render(<BodyMap counts={{}} onZonePress={jest.fn()} />);

    for (const zone of ['throat', 'chest', 'tummy']) {
      const style = StyleSheet.flatten(screen.getByTestId(`zone-label-row-${zone}`).props.style);
      expect(style).toMatchObject({ position: 'absolute', left: 0, right: 0 });
    }
  });
});
