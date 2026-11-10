import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { FoodVerdict, VerdictHero } from '@/components/food/FoodVerdict';
import type { MealAnalysis } from '@/types/analysis';

const analysis: MealAnalysis = {
  isFood: true,
  mealName: 'Spicy chicken tacos',
  items: [
    {
      name: 'Tacos',
      ingredients: [{ name: 'Chili', matchedCategories: ['spicy'] }],
      verdict: 'trigger',
      reasoning: 'Chili can irritate the throat and stomach.',
      matchedTriggers: [{ category: 'spicy', evidence: 'chili' }],
    },
  ],
  overall: {
    verdict: 'trigger',
    confidence: 'high',
    reasoning: 'Chili can irritate the throat and stomach.',
  },
};

describe('FoodVerdict', () => {
  it('leaves out the verdict badge, since the speech bubble already says it', async () => {
    await render(<FoodVerdict analysis={analysis} late={false} />);

    expect(screen.getByRole('header', { name: "Your belly probably won't like this." })).toBeTruthy();
    expect(screen.queryByLabelText('Avoid')).toBeNull();
  });

  it('centres the badge under Bellie where a screen shows it, like the rest of the screen', async () => {
    await render(<VerdictHero analysis={analysis} late={false} />);

    const badge = screen.getByLabelText('Avoid');
    expect(StyleSheet.flatten(badge.props.style).alignSelf).toBe('center');
  });

  it('keeps the tip, the reasons and the disclaimer under an open "Why?" that a tap closes', async () => {
    await render(<FoodVerdict analysis={analysis} late={false} />);

    const why = screen.getByRole('button', { name: 'Why?' });
    expect(why.props.accessibilityState).toMatchObject({ expanded: true });
    expect(screen.getByText(/not medical advice/)).toBeTruthy();

    await fireEvent.press(why);

    expect(screen.getByRole('button', { name: 'Why?' }).props.accessibilityState).toMatchObject({
      expanded: false,
    });
    expect(screen.queryByText(/not medical advice/)).toBeNull();
  });
});
