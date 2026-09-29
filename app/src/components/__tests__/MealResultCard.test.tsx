import { fireEvent, render, screen } from '@testing-library/react-native';

import type { MealAnalysis, TriggerCategory } from '@/types/analysis';

import { MealResultCard } from '../MealResultCard';

const ingredient = (name: string, matchedCategories: TriggerCategory[] = []) => ({ name, matchedCategories });

const analysis = (ingredients: ReturnType<typeof ingredient>[]): MealAnalysis => ({
  isFood: true,
  mealName: 'Dim sum',
  items: [
    {
      name: 'Siu mai',
      ingredients,
      verdict: 'caution',
      reasoning: 'Fatty pork and chili oil.',
      matchedTriggers: [],
    },
  ],
  overall: { verdict: 'caution', confidence: 'medium', reasoning: 'A few triggers.' },
});

describe('MealResultCard ingredients', () => {
  it('shows a short main-ingredients line with the trigger ones kept, and hides the rest', async () => {
    const long = ['pork', 'shrimp', 'mushroom', 'wrapper', 'ginger', 'sesame', 'scallion'].map((n) =>
      ingredient(n),
    );
    long.splice(5, 0, ingredient('chili oil', ['spicy']));
    await render(<MealResultCard analysis={analysis(long)} />);

    expect(screen.getByText(/Main ingredients: pork, shrimp, mushroom, chili oil/)).toBeTruthy();
    expect(screen.queryByText(/scallion/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Show all 8 ingredients' })).toBeTruthy();
  });

  it('shows the full list on tap and can collapse it again', async () => {
    const long = ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => ingredient(n));
    await render(<MealResultCard analysis={analysis(long)} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Show all 6 ingredients' }));
    expect(screen.getByText(/Ingredients: a, b, c, d, e, f/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Show fewer ingredients' }));
    expect(screen.getByText(/Main ingredients: a, b, c, d/)).toBeTruthy();
    expect(screen.queryByText(/e, f/)).toBeNull();
  });

  it('has no toggle when the list is already short', async () => {
    await render(<MealResultCard analysis={analysis([ingredient('rice'), ingredient('egg')])} />);

    expect(screen.getByText(/Ingredients: rice, egg/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Show/ })).toBeNull();
  });

  it('shows no ingredient line when there are none', async () => {
    await render(<MealResultCard analysis={analysis([])} />);

    expect(screen.queryByText(/ngredients/)).toBeNull();
  });
});
