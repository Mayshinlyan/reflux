import { fireEvent, render, screen } from '@testing-library/react-native';

import { weekOf } from '@/lib/week';
import { lightColors } from '@/theme';

import { WeekStrip } from '../WeekStrip';

// A Wednesday: Sunday to Tuesday are behind it, Thursday to Saturday are still to come.
const days = weekOf('2026-09-30');

describe('WeekStrip', () => {
  it('shows the week with today marked and a dot only on days with entries', async () => {
    await render(<WeekStrip days={days} loggedDays={new Set(['2026-09-28'])} onPressDay={jest.fn()} />);

    expect(screen.getByLabelText('Today, Wednesday 30')).toBeTruthy();
    expect(screen.getByLabelText('Monday 28, has entries')).toBeTruthy();
    expect(screen.getByLabelText('Tuesday 29')).toBeTruthy();
    expect(screen.getByText('30').parent).toHaveStyle({ backgroundColor: lightColors.cta });
  });

  it('reports the day tapped, for today and earlier days', async () => {
    const onPressDay = jest.fn();
    await render(<WeekStrip days={days} loggedDays={new Set()} onPressDay={onPressDay} />);

    await fireEvent.press(screen.getByLabelText('Monday 28'));
    await fireEvent.press(screen.getByLabelText('Today, Wednesday 30'));

    expect(onPressDay.mock.calls).toEqual([['2026-09-28'], ['2026-09-30']]);
  });

  it('does not let later days be tapped', async () => {
    const onPressDay = jest.fn();
    await render(<WeekStrip days={days} loggedDays={new Set()} onPressDay={onPressDay} />);

    const thursday = screen.getByLabelText('Thursday 1');
    expect(thursday.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(thursday);

    expect(onPressDay).not.toHaveBeenCalled();
  });

  it('hints that a tap logs symptoms for the day', async () => {
    await render(<WeekStrip days={days} loggedDays={new Set()} onPressDay={jest.fn()} />);

    expect(screen.getByLabelText('Tuesday 29').props.accessibilityHint).toBe('Log symptoms for this day');
  });
});
