import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { FoodVerdict } from '@/components/food/FoodVerdict';
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
  it('centres the verdict badge under Bellie, like the rest of the screen', async () => {
    await render(<FoodVerdict analysis={analysis} late={false} />);

    const badge = screen.getByLabelText('Avoid');
    expect(StyleSheet.flatten(badge.props.style).alignSelf).toBe('center');
  });
});
