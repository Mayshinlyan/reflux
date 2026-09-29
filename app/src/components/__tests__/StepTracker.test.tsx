import { render, screen } from '@testing-library/react-native';

import { lightColors } from '@/theme';

import { StepTracker } from '../StepTracker';

const fill = (n: number) => {
  const style = screen.getByTestId(`step-segment-${n}`).props.style;
  return [style].flat(Infinity).find((s: { backgroundColor?: string }) => s?.backgroundColor)
    ?.backgroundColor;
};

describe('StepTracker', () => {
  it('fills finished steps sage, the current step terracotta and later steps empty', async () => {
    await render(<StepTracker step={2} total={3} caption="Anything else" />);

    expect(fill(1)).toBe(lightColors.sage);
    expect(fill(2)).toBe(lightColors.cta);
    expect(fill(3)).toBe(lightColors.surface2);
  });

  it('is announced as a progress bar with the step in words', async () => {
    await render(<StepTracker step={3} total={3} caption="Add a note" label="Log symptoms progress" />);

    const bar = screen.getByRole('progressbar', { name: 'Log symptoms progress' });
    expect(bar.props.accessibilityValue).toEqual({
      min: 1,
      max: 3,
      now: 3,
      text: 'Step 3 of 3, Add a note',
    });
    expect(screen.getByText('Step 3 of 3 · Add a note')).toBeTruthy();
  });
});
