import type { StoredFoodLog } from '@/db/repositories/food';
import type { SymptomLogWithDetails } from '@/db/repositories/symptoms';

import type { LifestyleTagKey } from '@/constants/lifestyleTags';
import type { SymptomKey } from '@/constants/symptomItems';

import { donutSegments, goodLine, summarize } from '../historySummary';
import type { TimelineEntry } from '../timeline';

const meal = (id: number, verdict: StoredFoodLog['overallVerdict'], day: string) =>
  ({
    kind: 'food',
    id,
    at: `${day}T12:00:00.000Z`,
    tz: 'UTC',
    log: { overallVerdict: verdict } as StoredFoodLog,
  }) as TimelineEntry;

const symptom = (id: number, day: string, keys: SymptomKey[] = [], tags: LifestyleTagKey[] = []) =>
  ({
    kind: 'symptom',
    id,
    at: `${day}T20:00:00.000Z`,
    tz: 'UTC',
    log: { items: keys.map((key) => ({ key, score: 1 })), tags } as SymptomLogWithDetails,
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
    expect(summary).toMatchObject({
      meals: 4,
      symptomDays: 2,
      verdicts: { good: 1, ok: 0, caution: 1, trigger: 1 },
    });
  });

  it('is all zeros for an empty period, with every tag listed at 0', () => {
    const summary = summarize([], dayOf);
    expect(summary).toMatchObject({
      meals: 0,
      symptomDays: 0,
      verdicts: { good: 0, ok: 0, caution: 0, trigger: 0 },
      symptoms: [],
    });
    expect(summary.tags).toHaveLength(6);
    expect(summary.tags.every((tag) => tag.count === 0)).toBe(true);
  });

  it('ranks symptoms by how many entries have them, most first, and keeps the top six', () => {
    const summary = summarize(
      [
        symptom(1, '2026-10-10', ['burping', 'heartburn']),
        symptom(2, '2026-10-09', ['heartburn']),
        symptom(3, '2026-10-09', ['hoarseness', 'throat_clearing', 'mucus', 'cough', 'lump']),
      ],
      dayOf,
    );
    expect(summary.symptoms).toHaveLength(6);
    expect(summary.symptoms[0]).toEqual({ key: 'heartburn', label: 'Heartburn', count: 2 });
    expect(summary.symptoms[1]).toMatchObject({ key: 'burping', count: 1 });
  });

  it('counts a tag once per entry, from symptom entries and meals, ranked with ties in the picker order', () => {
    const summary = summarize(
      [
        meal(1, 'good', '2026-10-10'),
        meal(2, 'ok', '2026-10-10'),
        symptom(1, '2026-10-10', ['heartburn'], ['alcohol', 'stress']),
      ],
      dayOf,
      new Map<number, LifestyleTagKey[]>([
        [1, ['stress', 'large_meal']],
        [2, ['stress']],
      ]),
    );
    expect(summary.tags.map((tag) => [tag.key, tag.count])).toEqual([
      ['stress', 3],
      ['large_meal', 1],
      ['alcohol', 1],
      ['lay_down_after_eating', 0],
      ['exercise', 0],
      ['poor_sleep', 0],
    ]);
  });
});

describe('goodLine', () => {
  const withVerdicts = (good: number, ok: number, caution = 0, trigger = 0) =>
    summarize(
      [
        ...Array.from({ length: good }, (_, i) => meal(i, 'good', '2026-10-10')),
        ...Array.from({ length: ok }, (_, i) => meal(100 + i, 'ok', '2026-10-10')),
        ...Array.from({ length: caution }, (_, i) => meal(200 + i, 'caution', '2026-10-10')),
        ...Array.from({ length: trigger }, (_, i) => meal(300 + i, 'trigger', '2026-10-10')),
      ],
      dayOf,
    );

  it('says how much of the rated meals were good', () => {
    expect(goodLine(withVerdicts(4, 0))).toBe('All of your meals were good.');
    expect(goodLine(withVerdicts(3, 1))).toBe('Most of your meals were good.');
    expect(goodLine(withVerdicts(2, 2))).toBe('Half of your meals were good.');
    expect(goodLine(withVerdicts(1, 3))).toBe('Some of your meals were good.');
    expect(goodLine(withVerdicts(0, 3))).toBe('None of your meals were good.');
  });

  it('says there are no verdicts when no meal has one', () => {
    expect(goodLine(summarize([meal(1, null, '2026-10-10')], dayOf))).toBe('No verdicts yet.');
    expect(goodLine(summarize([], dayOf))).toBe('No verdicts yet.');
  });
});

describe('donutSegments', () => {
  it('splits the circle in proportion to the verdicts, in order, with a gap between arcs', () => {
    const segments = donutSegments({ good: 2, ok: 1, caution: 0, trigger: 1 }, 0.1);
    expect(segments.map((segment) => segment.verdict)).toEqual(['good', 'ok', 'trigger']);
    const usable = 2 * Math.PI - 0.3;
    expect(segments[0]!.sweep).toBeCloseTo(usable / 2);
    expect(segments[1]!.sweep).toBeCloseTo(usable / 4);
    expect(segments[1]!.start).toBeCloseTo(segments[0]!.start + segments[0]!.sweep + 0.1);
  });

  it('closes into a full ring with no gap when there is one verdict, and is empty with none', () => {
    expect(donutSegments({ good: 3, ok: 0, caution: 0, trigger: 0 })).toEqual([
      { verdict: 'good', start: 0, sweep: 2 * Math.PI },
    ]);
    expect(donutSegments({ good: 0, ok: 0, caution: 0, trigger: 0 })).toEqual([]);
  });
});
