import type { StoredFoodLog } from '@/db/repositories/food';
import type { SymptomLogWithDetails } from '@/db/repositories/symptoms';

import { summarize } from '../historySummary';
import type { TimelineEntry } from '../timeline';

const meal = (id: number, verdict: StoredFoodLog['overallVerdict'], day: string) =>
  ({
    kind: 'food',
    id,
    at: `${day}T12:00:00.000Z`,
    tz: 'UTC',
    log: { overallVerdict: verdict } as StoredFoodLog,
  }) as TimelineEntry;

const symptom = (id: number, day: string) =>
  ({
    kind: 'symptom',
    id,
    at: `${day}T20:00:00.000Z`,
    tz: 'UTC',
    log: {} as SymptomLogWithDetails,
  }) as TimelineEntry;

const dayOf = (entry: TimelineEntry) => entry.at.slice(0, 10);

describe('summarize', () => {
  it('counts meals, the verdict mix, and the days that have symptoms', () => {
    const summary = summarize(
      [
        meal(1, 'good', '2026-10-10'),
        meal(2, 'caution', '2026-10-10'),
        meal(3, 'trigger', '2026-10-09'),
        meal(4, null, '2026-10-09'),
        symptom(1, '2026-10-10'),
        symptom(2, '2026-10-10'),
        symptom(3, '2026-10-08'),
      ],
      dayOf,
    );
    expect(summary).toEqual({
      meals: 4,
      symptomDays: 2,
      verdicts: { good: 1, ok: 0, caution: 1, trigger: 1 },
    });
  });

  it('is all zeros for an empty period', () => {
    expect(summarize([], dayOf)).toEqual({
      meals: 0,
      symptomDays: 0,
      verdicts: { good: 0, ok: 0, caution: 0, trigger: 0 },
    });
  });
});
