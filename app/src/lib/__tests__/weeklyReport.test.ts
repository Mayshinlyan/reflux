import type { LoggedSymptomKey } from '@/constants/symptomItems';
import type { StoredFoodLog } from '@/db/repositories/food';
import type { SymptomLogWithDetails } from '@/db/repositories/symptoms';
import type { TriggerCategory } from '@/types/analysis';

import { triggerPatterns } from '../statsCards';
import type { TimelineEntry } from '../timeline';
import { buildWeeklyReport, lastFullWeek, REPORT_MIN_MEALS, whenSentence } from '../weeklyReport';

const meal = (id: number, name: string, at: string, triggers: TriggerCategory[] = []) =>
  ({
    kind: 'food',
    id,
    at,
    tz: 'UTC',
    log: {
      id,
      mealName: name,
      overallVerdict: 'ok',
      analysis: {
        items: [
          {
            matchedTriggers: triggers.map((category) => ({ category, evidence: 'because' })),
          },
        ],
      },
    } as unknown as StoredFoodLog,
  }) as TimelineEntry;

const symptom = (id: number, at: string, keys: LoggedSymptomKey[] = ['heartburn']) =>
  ({
    kind: 'symptom',
    id,
    at,
    tz: 'UTC',
    log: {
      items: keys.map((key) => ({ key, score: 1 })),
      tags: [],
      foodLogId: null,
    } as unknown as SymptomLogWithDetails,
  }) as TimelineEntry;

const LATER = new Date('2026-11-20T12:00:00.000Z');
const ZERO = { morning: 0, afternoon: 0, evening: 0, night: 0 };

describe('lastFullWeek', () => {
  it('is the Sunday-to-Saturday week before the one today is in', () => {
    // 2026-10-10 is a Saturday, so its own week is not over yet.
    expect(lastFullWeek('2026-10-10')).toEqual({ startKey: '2026-09-27', endKey: '2026-10-03' });
  });

  it('turns over on Sunday, when the week that just ended is the one to report', () => {
    expect(lastFullWeek('2026-10-11')).toEqual({ startKey: '2026-10-04', endKey: '2026-10-10' });
  });
});

describe('whenSentence', () => {
  it('says nothing when no symptoms were logged', () => {
    expect(whenSentence(ZERO)).toBeNull();
  });

  it('names the part of the day with the most symptoms', () => {
    expect(whenSentence({ ...ZERO, evening: 4, morning: 1 })).toBe('Mostly in the evening, after 6pm.');
    expect(whenSentence({ ...ZERO, night: 3 })).toBe('Mostly at night.');
  });

  it('says it spreads out when the top two are level', () => {
    expect(whenSentence({ ...ZERO, morning: 2, evening: 2 })).toBe('All through the day.');
  });
});

describe('buildWeeklyReport', () => {
  it('counts a food eaten once in each of two weeks, because the lists read the whole history', () => {
    const entries = [
      meal(1, 'Oatmeal', '2026-09-30T08:00:00.000Z'),
      meal(2, 'Oatmeal', '2026-10-07T08:00:00.000Z'),
    ];
    const report = buildWeeklyReport({ entries, weekEntries: entries.slice(1), now: LATER });

    expect(report.sat).toEqual([{ name: 'Oatmeal', times: 2, withSymptoms: 0 }]);
    expect(report.hasContent).toBe(true);
  });

  it('puts a food symptoms followed under watch, and keeps it out of sat well', () => {
    const entries = [
      meal(1, 'Spicy tacos', '2026-10-04T19:00:00.000Z'),
      symptom(2, '2026-10-04T21:00:00.000Z'),
      meal(3, 'Spicy tacos', '2026-10-06T19:00:00.000Z'),
      symptom(4, '2026-10-06T21:30:00.000Z'),
    ];
    const report = buildWeeklyReport({ entries, weekEntries: entries, now: LATER });

    expect(report.watch).toEqual([{ name: 'Spicy tacos', times: 2, withSymptoms: 2 }]);
    expect(report.sat).toEqual([]);
    expect(report.whenText).toBe('Mostly in the evening, after 6pm.');
  });

  it('says how many more meals it needs, down to none', () => {
    const some = [meal(1, 'Toast', '2026-10-04T08:00:00.000Z'), meal(2, 'Rice', '2026-10-05T08:00:00.000Z')];
    expect(buildWeeklyReport({ entries: some, weekEntries: some, now: LATER }).mealsNeeded).toBe(
      REPORT_MIN_MEALS - 2,
    );
    expect(buildWeeklyReport({ entries: [], weekEntries: [], now: LATER }).mealsNeeded).toBe(
      REPORT_MIN_MEALS,
    );

    const enough = Array.from({ length: REPORT_MIN_MEALS }, (_, i) =>
      meal(i + 1, `Meal ${i}`, `2026-10-0${i + 1}T08:00:00.000Z`),
    );
    expect(buildWeeklyReport({ entries: enough, weekEntries: enough, now: LATER }).mealsNeeded).toBe(0);
  });

  it('has nothing to show for a week with no repeats and no symptoms', () => {
    const entries = [
      meal(1, 'Toast', '2026-10-04T08:00:00.000Z'),
      meal(2, 'Rice', '2026-10-05T08:00:00.000Z'),
    ];
    expect(buildWeeklyReport({ entries, weekEntries: entries, now: LATER }).hasContent).toBe(false);
  });

  it('lists at most three foods to watch, the worst first, mixing dishes and kinds of food', () => {
    const entries: TimelineEntry[] = [];
    let id = 1;
    // Four different dishes, each eaten twice with symptoms after both times.
    for (const dish of ['A', 'B', 'C', 'D']) {
      for (const day of ['04', '05']) {
        entries.push(meal(id++, dish, `2026-10-${day}T19:00:00.000Z`));
        entries.push(symptom(id++, `2026-10-${day}T21:00:00.000Z`));
      }
    }
    const report = buildWeeklyReport({ entries, weekEntries: entries, now: LATER });
    expect(report.watch).toHaveLength(3);
  });
});

describe('triggerPatterns', () => {
  const spicyWeek = (withSymptoms: number, meals: number) => {
    const entries: TimelineEntry[] = [];
    for (let i = 0; i < meals; i += 1) {
      const day = `2026-10-${String(4 + i).padStart(2, '0')}`;
      entries.push(meal(i * 2 + 1, `Dish ${i}`, `${day}T19:00:00.000Z`, ['spicy']));
      if (i < withSymptoms) entries.push(symptom(i * 2 + 2, `${day}T21:00:00.000Z`));
    }
    return entries;
  };

  it('calls out a kind of food when symptoms followed at least half of three or more meals', () => {
    expect(triggerPatterns(spicyWeek(3, 4), LATER)).toEqual([
      { name: 'Spicy meals', times: 4, withSymptoms: 3 },
    ]);
  });

  it('needs three meals, so a rough evening or two decides nothing', () => {
    expect(triggerPatterns(spicyWeek(2, 2), LATER)).toEqual([]);
  });

  it('stays quiet when symptoms followed fewer than half of the meals', () => {
    expect(triggerPatterns(spicyWeek(2, 5), LATER)).toEqual([]);
  });

  it('ignores meals the check found no triggers in', () => {
    const entries = [
      meal(1, 'Rice', '2026-10-04T19:00:00.000Z'),
      symptom(2, '2026-10-04T21:00:00.000Z'),
      meal(3, 'Toast', '2026-10-05T19:00:00.000Z'),
      symptom(4, '2026-10-05T21:00:00.000Z'),
      meal(5, 'Soup', '2026-10-06T19:00:00.000Z'),
      symptom(6, '2026-10-06T21:00:00.000Z'),
    ];
    expect(triggerPatterns(entries, LATER)).toEqual([]);
  });
});
