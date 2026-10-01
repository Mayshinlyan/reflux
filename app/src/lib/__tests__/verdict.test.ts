import type { MealAnalysis } from '@/types/analysis';

import { effectiveVerdict, withUserVerdict } from '../verdict';

const meal: MealAnalysis = {
  isFood: true,
  mealName: 'Mint tea',
  items: [],
  overall: { verdict: 'caution', confidence: 'high', reasoning: 'Mint is a common trigger.' },
};

describe('user verdict', () => {
  it("is the AI's verdict until the user sets one", () => {
    expect(effectiveVerdict(meal)).toBe('caution');
    expect(effectiveVerdict(withUserVerdict(meal, 'good'))).toBe('good');
  });

  it("keeps the AI's verdict and reasoning, and removes the override when the AI's own is chosen", () => {
    const mine = withUserVerdict(meal, 'good');
    expect(mine.overall).toEqual({ ...meal.overall, userVerdict: 'good' });
    expect(withUserVerdict(mine, 'caution')).toEqual(meal);
    expect(withUserVerdict(mine, 'ok').overall.userVerdict).toBe('ok');
  });
});
