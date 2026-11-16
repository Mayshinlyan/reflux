import type { StoredPlan } from '@/db/repositories/mealPlans';

import { weekIsEnding } from '../weekResult';

const plan = (weekStart: string) => ({ weekStart }) as StoredPlan;

describe('weekIsEnding', () => {
  it('is the Saturday of a week that starts on a Sunday, and after', () => {
    // 2026-11-15 is a Sunday.
    expect(weekIsEnding(plan('2026-11-15'), '2026-11-20')).toBe(false);
    expect(weekIsEnding(plan('2026-11-15'), '2026-11-21')).toBe(true);
    expect(weekIsEnding(plan('2026-11-15'), '2026-11-25')).toBe(true);
  });

  it('is still the Saturday of a week that started on a Monday, as before', () => {
    expect(weekIsEnding(plan('2026-11-16'), '2026-11-20')).toBe(false);
    expect(weekIsEnding(plan('2026-11-16'), '2026-11-21')).toBe(true);
  });
});
