import type { MealAnalysis } from '@/types/analysis';

import { matchedTriggerLabels, verdictReasons } from '../verdictReasons';

const analysis = (reasoning: string, categories: ('spicy' | 'acidic')[][] = []): MealAnalysis => ({
  isFood: true,
  mealName: 'Tacos',
  items: categories.map((matched, index) => ({
    name: `Item ${index}`,
    ingredients: [],
    verdict: 'caution',
    reasoning: 'Item reason.',
    matchedTriggers: matched.map((category) => ({ category, evidence: 'x' })),
  })),
  overall: { verdict: 'caution', confidence: 'high', reasoning },
});

describe('verdictReasons', () => {
  it('splits the overall reasoning into sentences', () => {
    expect(verdictReasons(analysis('Chili can irritate. Salsa is acidic.'), { late: false })).toEqual([
      'Chili can irritate.',
      'Salsa is acidic.',
    ]);
  });

  it('adds the bedtime note and keeps at most four bullets', () => {
    const reasons = verdictReasons(analysis('One. Two. Three. Four. Five.'), { late: true });
    expect(reasons).toEqual(['One.', 'Two.', 'Three.', 'Eaten close to bedtime.']);
  });

  it('keeps text without a final full stop and falls back to the first item', () => {
    expect(verdictReasons(analysis('Rich and creamy'), { late: false })).toEqual(['Rich and creamy']);
    expect(verdictReasons(analysis('', [['spicy']]), { late: false })).toEqual(['Item reason.']);
  });
});

describe('matchedTriggerLabels', () => {
  it('lists each category once, then Late meal', () => {
    expect(matchedTriggerLabels(analysis('x', [['spicy'], ['spicy', 'acidic']]), { late: true })).toEqual([
      'Spicy',
      'Acidic',
      'Late meal',
    ]);
  });

  it('is empty when nothing matched and the meal is not late', () => {
    expect(matchedTriggerLabels(analysis('x'), { late: false })).toEqual([]);
  });
});
