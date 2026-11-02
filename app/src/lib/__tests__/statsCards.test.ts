import type { LoggedSymptomKey } from '@/constants/symptomItems';
import type { LoggedTagKey } from '@/constants/lifestyleTags';
import type { StoredFoodLog } from '@/db/repositories/food';
import type { SymptomLogWithDetails } from '@/db/repositories/symptoms';

import { summarize } from '../historySummary';
import {
  buildStats,
  calmComparison,
  calmHeadline,
  dayStats,
  goodComparison,
  lateMeals,
  mealPatterns,
  mostlySymptoms,
  oftenWith,
  symptomsByTime,
  timeOfDay,
  whenTitle,
} from '../statsCards';
import type { TimelineEntry } from '../timeline';

const meal = (id: number, name: string, at: string, verdict: StoredFoodLog['overallVerdict'] = 'ok') =>
  ({
    kind: 'food',
    id,
    at,
    tz: 'UTC',
    log: { id, mealName: name, overallVerdict: verdict } as StoredFoodLog,
  }) as TimelineEntry;

const symptom = (
  id: number,
  at: string,
  keys: LoggedSymptomKey[] = [],
  extra: { foodLogId?: number; tags?: LoggedTagKey[] } = {},
) =>
  ({
    kind: 'symptom',
    id,
    at,
    tz: 'UTC',
    log: {
      items: keys.map((key) => ({ key, score: 1 })),
      tags: extra.tags ?? [],
      foodLogId: extra.foodLogId ?? null,
    } as unknown as SymptomLogWithDetails,
  }) as TimelineEntry;

const dayOf = (entry: TimelineEntry) => entry.at.slice(0, 10);
const WEEK = { startKey: '2026-10-04', endKey: '2026-10-10' };
const LATER = new Date('2026-10-20T12:00:00.000Z');

describe('dayStats', () => {
  it('marks a day calm with entries and no symptoms, and counts symptoms for the rest', () => {
    const days = dayStats(
      [
        meal(1, 'Oatmeal', '2026-10-04T08:00:00.000Z'),
        symptom(2, '2026-10-05T20:00:00.000Z', ['heartburn']),
        symptom(3, '2026-10-06T20:00:00.000Z', ['heartburn', 'burping']),
        symptom(4, '2026-10-07T20:00:00.000Z', ['heartburn', 'burping', 'cough']),
      ],
      WEEK,
      '2026-10-10',
    );

    expect(days.map((day) => day.state)).toEqual(['calm', 'some', 'some', 'lots', 'none', 'none', 'none']);
    expect(days[2]!.symptoms).toEqual(['Heartburn', 'Burping']);
  });

  it('counts a symptom once however many entries it is in, and a lifestyle-only entry as calm', () => {
    const days = dayStats(
      [
        symptom(1, '2026-10-04T08:00:00.000Z', ['heartburn']),
        symptom(2, '2026-10-04T20:00:00.000Z', ['heartburn']),
        symptom(3, '2026-10-05T20:00:00.000Z', [], { tags: ['stress'] }),
      ],
      WEEK,
      '2026-10-10',
    );

    expect(days[0]).toMatchObject({ state: 'some', symptoms: ['Heartburn'] });
    expect(days[1]!.state).toBe('calm');
  });

  it('stops at today, so days still to come are left out', () => {
    expect(dayStats([], WEEK, '2026-10-06').map((day) => day.dayKey)).toEqual([
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
    ]);
  });

  it('is empty when the period has not started', () => {
    expect(dayStats([], WEEK, '2026-10-01')).toEqual([]);
  });
});

describe('calmHeadline and calmComparison', () => {
  const states = (list: string) =>
    list.split('').map((letter, i) => ({
      dayKey: `2026-10-0${i + 1}`,
      state: ({ c: 'calm', s: 'some', n: 'none' } as const)[letter as 'c' | 's' | 'n'],
      symptoms: [],
    }));

  it('words the count', () => {
    expect(calmHeadline(states('ccsn'))).toBe('2 calm days');
    expect(calmHeadline(states('csn'))).toBe('1 calm day');
    expect(calmHeadline(states('ssn'))).toBe('No calm days');
  });

  it('says how it compares with the last period', () => {
    expect(calmComparison(states('cccs'), states('csss'), 'week')).toBe('2 more than last week');
    expect(calmComparison(states('cscs'), states('cccs'), 'month')).toBe('1 fewer than last month');
    expect(calmComparison(states('cs'), states('cs'), 'week')).toBe('Same as last week');
  });

  it('compares only as many days as have happened so far', () => {
    // Last week had 3 calm days in all, but only the first 2 days are in play now.
    expect(calmComparison(states('cc'), states('cscccc'), 'week')).toBe('1 more than last week');
  });

  it('says nothing without a last period to compare with, or when nothing was logged in it', () => {
    expect(calmComparison(states('cc'), null, 'week')).toBeUndefined();
    expect(calmComparison(states('cc'), states('nnnn'), 'week')).toBeUndefined();
  });
});

describe('mealPatterns', () => {
  it('lists meals eaten twice or more with no symptoms after as sat well, most often first', () => {
    const { sat } = mealPatterns(
      [
        meal(1, 'Oatmeal', '2026-10-04T08:00:00.000Z'),
        meal(2, 'Oatmeal', '2026-10-05T08:00:00.000Z'),
        meal(3, 'Oatmeal', '2026-10-06T08:00:00.000Z'),
        meal(4, 'Salmon', '2026-10-04T12:00:00.000Z'),
        meal(5, 'Salmon', '2026-10-05T12:00:00.000Z'),
        meal(6, 'Toast', '2026-10-05T09:00:00.000Z'),
      ],
      LATER,
    );

    expect(sat).toEqual([
      { name: 'Oatmeal', times: 3, withSymptoms: 0 },
      { name: 'Salmon', times: 2, withSymptoms: 0 },
    ]);
  });

  it('calls out a meal that was followed by symptoms at least twice, with how often', () => {
    const { sat, watch } = mealPatterns(
      [
        meal(1, 'Spicy tacos', '2026-10-04T19:00:00.000Z'),
        symptom(2, '2026-10-04T21:00:00.000Z', ['heartburn']),
        meal(3, 'spicy tacos', '2026-10-06T19:00:00.000Z'),
        symptom(4, '2026-10-06T22:30:00.000Z', ['burping']),
        meal(5, 'Spicy tacos', '2026-10-08T19:00:00.000Z'),
      ],
      LATER,
    );

    expect(watch).toEqual([{ name: 'Spicy tacos', times: 3, withSymptoms: 2 }]);
    expect(sat).toEqual([]);
  });

  it('does not call out a meal followed by symptoms only once', () => {
    const { watch } = mealPatterns(
      [
        meal(1, 'Pasta', '2026-10-04T19:00:00.000Z'),
        symptom(2, '2026-10-04T21:00:00.000Z', ['heartburn']),
        meal(3, 'Pasta', '2026-10-06T19:00:00.000Z'),
      ],
      LATER,
    );

    expect(watch).toEqual([]);
  });

  it('counts a symptom entry linked to the meal even if it was logged much later', () => {
    const { watch } = mealPatterns(
      [
        meal(1, 'Curry', '2026-10-04T12:00:00.000Z'),
        symptom(2, '2026-10-05T07:00:00.000Z', ['heartburn'], { foodLogId: 1 }),
        meal(3, 'Curry', '2026-10-06T12:00:00.000Z'),
        symptom(4, '2026-10-06T23:00:00.000Z', ['heartburn'], { foodLogId: 3 }),
      ],
      LATER,
    );

    expect(watch).toEqual([{ name: 'Curry', times: 2, withSymptoms: 2 }]);
  });

  it('does not count symptoms from before a meal, from long after it, or a lifestyle-only entry', () => {
    const { sat } = mealPatterns(
      [
        symptom(1, '2026-10-04T10:00:00.000Z', ['heartburn']),
        meal(2, 'Soup', '2026-10-04T12:00:00.000Z'),
        symptom(3, '2026-10-04T17:00:00.000Z', ['heartburn']),
        meal(4, 'Soup', '2026-10-05T12:00:00.000Z'),
        symptom(5, '2026-10-05T13:00:00.000Z', [], { tags: ['stress'] }),
      ],
      LATER,
    );

    expect(sat).toEqual([{ name: 'Soup', times: 2, withSymptoms: 0 }]);
  });

  it('leaves out a meal still inside the window with no symptoms yet', () => {
    const now = new Date('2026-10-10T20:00:00.000Z');
    const { sat } = mealPatterns(
      [
        meal(1, 'Rice', '2026-10-08T12:00:00.000Z'),
        meal(2, 'Rice', '2026-10-09T12:00:00.000Z'),
        meal(3, 'Rice', '2026-10-10T18:00:00.000Z'),
      ],
      now,
    );

    expect(sat).toEqual([{ name: 'Rice', times: 2, withSymptoms: 0 }]);
  });

  it('keeps each list to three rows', () => {
    const names = ['A', 'B', 'C', 'D'];
    const entries = names.flatMap((name, i) => [
      meal(i * 2 + 1, name, '2026-10-04T08:00:00.000Z'),
      meal(i * 2 + 2, name, '2026-10-05T08:00:00.000Z'),
    ]);

    expect(mealPatterns(entries, LATER).sat).toHaveLength(3);
  });
});

describe('time of day', () => {
  it('puts each hour in a part of the day', () => {
    const at = (hour: number, minute = 0) =>
      `2026-10-04T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
    expect(timeOfDay(at(4, 59), 'UTC')).toBe('night');
    expect(timeOfDay(at(5), 'UTC')).toBe('morning');
    expect(timeOfDay(at(12), 'UTC')).toBe('afternoon');
    expect(timeOfDay(at(18), 'UTC')).toBe('evening');
    expect(timeOfDay(at(22), 'UTC')).toBe('night');
  });

  it('reads the hour where the entry was logged', () => {
    // 20:00 UTC is 4 am the next day in Singapore (UTC+8).
    expect(timeOfDay('2026-10-04T20:00:00.000Z', 'Asia/Singapore')).toBe('night');
    expect(timeOfDay('2026-10-04T23:00:00.000Z', 'Asia/Singapore')).toBe('morning');
  });

  it('counts every symptom at its entry time', () => {
    const counts = symptomsByTime([
      symptom(1, '2026-10-04T20:00:00.000Z', ['heartburn', 'burping']),
      symptom(2, '2026-10-05T07:00:00.000Z', ['heartburn']),
      meal(3, 'Toast', '2026-10-05T07:00:00.000Z'),
    ]);

    expect(counts).toEqual({ morning: 1, afternoon: 0, evening: 2, night: 0 });
  });

  it('titles the card by where most symptoms fell', () => {
    expect(whenTitle({ morning: 0, afternoon: 1, evening: 3, night: 1 })).toBe('Mostly evenings');
    expect(whenTitle({ morning: 2, afternoon: 0, evening: 0, night: 0 })).toBe('Mostly mornings');
    expect(whenTitle({ morning: 0, afternoon: 4, evening: 0, night: 1 })).toBe('Mostly afternoons');
    expect(whenTitle({ morning: 0, afternoon: 0, evening: 0, night: 3 })).toBe('Mostly at night');
  });

  it('says they are spread out when two parts of the day tie, and keeps a plain title with none', () => {
    expect(whenTitle({ morning: 0, afternoon: 2, evening: 2, night: 0 })).toBe('All through the day');
    expect(whenTitle({ morning: 0, afternoon: 0, evening: 0, night: 0 })).toBe('When it shows up');
  });
});

describe('lateMeals', () => {
  it('counts meals within the window of bedtime and how many had symptoms after', () => {
    const result = lateMeals(
      [
        meal(1, 'Pizza', '2026-10-04T21:00:00.000Z'),
        symptom(2, '2026-10-04T23:00:00.000Z', ['heartburn']),
        meal(3, 'Pasta', '2026-10-05T20:30:00.000Z'),
        meal(4, 'Lunch', '2026-10-05T12:00:00.000Z'),
      ],
      '22:30',
      180,
    );

    expect(result).toEqual({ late: 2, withSymptoms: 1 });
  });

  it('is zero with no meals', () => {
    expect(lateMeals([], '22:30', 180)).toEqual({ late: 0, withSymptoms: 0 });
  });
});

describe('lines under the numbers', () => {
  it('names the lifestyle factors logged most, up to two, in lower case', () => {
    const summary = summarize(
      [
        symptom(1, '2026-10-04T20:00:00.000Z', ['heartburn'], { tags: ['stress', 'poor_sleep'] }),
        symptom(2, '2026-10-05T20:00:00.000Z', ['heartburn'], { tags: ['stress'] }),
      ],
      dayOf,
    );

    expect(oftenWith(summary)).toBe('stress and poor sleep');
  });

  it('has no line when no factor was logged', () => {
    expect(oftenWith(summarize([], dayOf))).toBeUndefined();
  });

  it('names the symptoms logged most, up to two', () => {
    const summary = summarize(
      [
        symptom(1, '2026-10-04T20:00:00.000Z', ['heartburn', 'burping']),
        symptom(2, '2026-10-05T20:00:00.000Z', ['heartburn']),
        symptom(3, '2026-10-06T20:00:00.000Z', ['cough']),
      ],
      dayOf,
    );

    expect(mostlySymptoms(summary)).toBe('heartburn and burping');
    expect(mostlySymptoms(summarize([], dayOf))).toBeUndefined();
  });

  it('says how the good meals compare with the last period', () => {
    const verdicts = (good: number, bad: number) =>
      summarize(
        [
          ...Array.from({ length: good }, (_, i) => meal(i, 'A', '2026-10-04T08:00:00.000Z', 'good')),
          ...Array.from({ length: bad }, (_, i) => meal(100 + i, 'B', '2026-10-04T08:00:00.000Z', 'trigger')),
        ],
        dayOf,
      );

    expect(goodComparison(verdicts(5, 5), verdicts(4, 6), 'week')).toBe('50% good, up from 40% last week');
    expect(goodComparison(verdicts(3, 7), verdicts(5, 5), 'month')).toBe(
      '30% good, down from 50% last month',
    );
    expect(goodComparison(verdicts(5, 5), verdicts(1, 1), 'week')).toBe('50% good, same as last week');
  });

  it('has no comparison without rated meals in both periods', () => {
    const rated = summarize([meal(1, 'A', '2026-10-04T08:00:00.000Z', 'good')], dayOf);

    expect(goodComparison(rated, null, 'week')).toBeUndefined();
    expect(goodComparison(rated, summarize([], dayOf), 'week')).toBeUndefined();
    expect(goodComparison(summarize([], dayOf), rated, 'week')).toBeUndefined();
  });
});

describe('buildStats', () => {
  const base = {
    entries: [meal(1, 'Oatmeal', '2026-10-05T08:00:00.000Z', 'good')],
    period: WEEK,
    todayKey: '2026-10-10',
    bedtime: '22:30',
    windowMinutes: 180,
    now: LATER,
  };

  it('has a day-by-day card and a last week to compare with for a week', () => {
    const stats = buildStats({
      ...base,
      kind: 'week',
      previousEntries: [meal(2, 'Toast', '2026-09-28T08:00:00.000Z', 'good')],
    });

    expect(stats.unit).toBe('week');
    expect(stats.days).toHaveLength(7);
    expect(stats.previousDays).toHaveLength(7);
    expect(stats.previousSummary?.meals).toBe(1);
    expect(stats.windowMinutes).toBe(180);
  });

  it('has no day-by-day card and nothing to compare with for all time or picked dates', () => {
    for (const kind of ['all', 'custom'] as const) {
      const stats = buildStats({ ...base, kind, previousEntries: null });

      expect(stats.unit).toBeNull();
      expect(stats.days).toEqual([]);
      expect(stats.previousDays).toBeNull();
      expect(stats.previousSummary).toBeNull();
    }
  });
});
