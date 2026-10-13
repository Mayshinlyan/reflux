import type { MealAnalysis } from '@/types/analysis';

import { possibleCauses } from '../possibleCauses';

const analysis = (...categories: ('spicy' | 'high_fat')[]): MealAnalysis => ({
  isFood: true,
  mealName: 'Tacos',
  items: [
    {
      name: 'Tacos',
      ingredients: [],
      verdict: 'caution',
      reasoning: 'x',
      matchedTriggers: categories.map((category) => ({ category, evidence: 'x' })),
    },
  ],
  overall: { verdict: 'caution', confidence: 'high', reasoning: 'x' },
});

const base = { bedtime: '22:30', lateMealWindowMinutes: 180 };
const meal = (loggedAt: string, withAnalysis: MealAnalysis | null = null) => ({
  mealName: 'Spicy chicken tacos',
  loggedAt,
  tz: 'UTC',
  analysis: withAnalysis,
});

describe('possibleCauses', () => {
  it('has nothing to say without a meal', () => {
    expect(possibleCauses({ ...base, symptomAt: '2026-06-01T21:40:00Z' })).toEqual([]);
  });

  it('names the meal and how long before the symptoms it was', () => {
    expect(
      possibleCauses({ ...base, symptomAt: '2026-06-01T12:00:00Z', meal: meal('2026-06-01T11:20:00Z') }),
    ).toEqual(['Spicy chicken tacos, 40 minutes before']);
    expect(
      possibleCauses({ ...base, symptomAt: '2026-06-01T12:00:00Z', meal: meal('2026-06-01T10:00:00Z') }),
    ).toEqual(['Spicy chicken tacos, 2 hours before']);
    expect(
      possibleCauses({ ...base, symptomAt: '2026-06-01T12:00:00Z', meal: meal('2026-06-01T11:00:00Z') }),
    ).toEqual(['Spicy chicken tacos, 1 hour before']);
  });

  it('adds a late meal, counting from bedtime', () => {
    expect(
      possibleCauses({ ...base, symptomAt: '2026-06-01T23:30:00Z', meal: meal('2026-06-01T21:50:00Z') }),
    ).toEqual(['Spicy chicken tacos, 2 hours before', 'A late meal, 40 minutes before bed']);
    expect(
      possibleCauses({ ...base, symptomAt: '2026-06-02T00:30:00Z', meal: meal('2026-06-01T23:00:00Z') }),
    ).toEqual(['Spicy chicken tacos, 2 hours before', 'A late meal, 30 minutes after bedtime']);
  });

  it('adds what the meal check matched, in plain words', () => {
    expect(
      possibleCauses({
        ...base,
        symptomAt: '2026-06-01T12:00:00Z',
        meal: meal('2026-06-01T11:00:00Z', analysis('spicy', 'high_fat')),
      }),
    ).toEqual(['Spicy chicken tacos, 1 hour before', 'In that meal: Spicy, Fatty']);
  });

  it('skips a meal that came after the symptoms started', () => {
    expect(
      possibleCauses({ ...base, symptomAt: '2026-06-01T12:00:00Z', meal: meal('2026-06-01T12:30:00Z') }),
    ).toEqual([]);
  });
});
