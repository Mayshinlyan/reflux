import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { CardNavContext, StatCard, StatHeader } from '../stats/StatCard';

const card = (nav: { page: number; total: number; goTo: (page: number) => void } | null) => (
  <CardNavContext.Provider value={nav}>
    <StatCard width={300} height={400} gap={12}>
      <StatHeader title="4 days without symptoms" aside="1 more than last week" />
      <Text>Body</Text>
    </StatCard>
  </CardNavContext.Provider>
);

describe('StatCard', () => {
  it('has arrows at the top: Previous is dimmed on the first card, and Next goes to the second', async () => {
    const goTo = jest.fn();
    await render(card({ page: 1, total: 4, goTo }));

    const previous = screen.getByRole('button', { name: 'Previous card, none, you are on 1 of 4' });
    expect(previous.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Next card, 2 of 4' }));
    expect(goTo).toHaveBeenCalledWith(2);
  });

  it('dims Next on the last card, and Previous goes back one', async () => {
    const goTo = jest.fn();
    await render(card({ page: 4, total: 4, goTo }));

    expect(
      screen.getByRole('button', { name: 'Next card, none, you are on 4 of 4' }).props.accessibilityState
        .disabled,
    ).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Previous card, 3 of 4' }));
    expect(goTo).toHaveBeenCalledWith(3);
  });

  it('has no arrows outside the carousel, or when there is only one card', async () => {
    await render(card(null));
    expect(screen.queryByRole('button')).toBeNull();
    await screen.unmount();

    await render(card({ page: 1, total: 1, goTo: jest.fn() }));
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps a long title to two lines, clear of the arrows', async () => {
    await render(card({ page: 1, total: 4, goTo: jest.fn() }));

    expect(screen.getByRole('header', { name: '4 days without symptoms' }).props.numberOfLines).toBe(2);
  });
});
