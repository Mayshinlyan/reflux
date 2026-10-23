import { createTestDb } from '@/db/__tests__/testDb';
import { createFoodLog, createUncheckedMeal, listDiaryFoodLogs } from '@/db/repositories/food';
import { createSymptomLog, listSymptomLogs } from '@/db/repositories/symptoms';
import type { AppDb } from '@/db/types';
import { buildInsightRequest, fallbackInsight, insightHash, isInsight } from '@/lib/insight';
import { buildTimeline } from '@/lib/timeline';
import type { InsightRequest } from '@/types/insight';

let db: AppDb;
let closeDb: () => void;
beforeEach(() => {
  const created = createTestDb();
  db = created.db;
  closeDb = () => created.sqlite.close();
});
afterEach(() => closeDb());

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString();

const seedMeal = (name: string, verdict: 'ok' | 'caution' | 'trigger', loggedAt: string) =>
  createFoodLog(db, {
    entryType: 'diary',
    source: 'text',
    inputText: name,
    loggedAt,
    analysis: {
      isFood: true,
      mealName: name,
      items: [],
      overall: { verdict, confidence: 'high', reasoning: 'Because.' },
    },
    meta: { model: 'm', promptVersion: 'p', rulesetVersion: 'r' },
  });

const entries = () =>
  buildTimeline(
    { symptoms: listSymptomLogs(db, ALL), food: listDiaryFoodLogs(db, ALL), medications: [] },
    'all',
    new Date(2026, 9, 10, 23, 0),
  ).flatMap((section) => section.entries);
const ALL = { from: '2000-01-01T00:00:00.000Z', to: '2100-01-01T00:00:00.000Z' };

describe('buildInsightRequest', () => {
  it('sends meal names with their verdicts, symptom names and tags, oldest first, with just the time for a day', () => {
    const tacos = seedMeal('Spicy chicken tacos', 'caution', at(10, 19, 45));
    seedMeal('Oatmeal with banana', 'ok', at(10, 8, 12));
    createSymptomLog(db, {
      items: [{ key: 'heartburn' }, { key: 'burping' }],
      tags: ['stress'],
      foodLogId: tacos,
      loggedAt: at(10, 21, 40),
    });

    expect(buildInsightRequest('day', entries())).toEqual({
      range: 'day',
      meals: [
        { name: 'Oatmeal with banana', verdict: 'ok', when: '8:12 AM' },
        { name: 'Spicy chicken tacos', verdict: 'caution', when: '7:45 PM' },
      ],
      symptoms: [
        { name: 'Heartburn', when: '9:40 PM' },
        { name: 'Burping', when: '9:40 PM' },
      ],
      tags: ['Stress'],
    });
  });

  it('puts the weekday in front of the time for a week', () => {
    seedMeal('Oatmeal with banana', 'ok', at(10, 8, 12)); // Saturday, Oct 10 2026
    seedMeal('Pasta with tomato sauce', 'trigger', at(8, 20, 5)); // Thursday

    const request = buildInsightRequest('week', entries());

    expect(request?.meals.map((meal) => meal.when)).toEqual(['Thu 8:05 PM', 'Sat 8:12 AM']);
  });

  it('leaves out a meal that was logged without a verdict, and anything else that is not a meal or symptom', () => {
    createUncheckedMeal(db, { source: 'text', inputText: 'Banana bread', loggedAt: at(10, 15, 0) });
    seedMeal('Mint tea', 'caution', at(10, 16, 0));

    expect(buildInsightRequest('day', entries())?.meals.map((meal) => meal.name)).toEqual(['Mint tea']);
  });

  it('counts lifestyle-only check-ins by their tags, with no symptoms', () => {
    seedMeal('Mint tea', 'caution', at(10, 16, 0));
    createSymptomLog(db, { items: [], tags: ['alcohol'], loggedAt: at(10, 20, 0) });

    const request = buildInsightRequest('day', entries());

    expect(request?.symptoms).toEqual([]);
    expect(request?.tags).toEqual(['Alcohol']);
  });

  it('leaves out a typed symptom or tag that is nothing but symbols, so it cannot sink the whole summary', () => {
    seedMeal('Mint tea', 'caution', at(10, 16, 0));
    createSymptomLog(db, {
      items: [{ key: 'custom:<>' }, { key: 'custom:Hiccups' }, { key: 'custom:<b>' }],
      tags: ['custom:>>>', 'custom:Skipped breakfast'],
      loggedAt: at(10, 20, 0),
    });

    const request = buildInsightRequest('day', entries());

    expect(request?.symptoms.map((symptom) => symptom.name).sort()).toEqual(['Hiccups', 'b']);
    expect(request?.tags).toEqual(['Skipped breakfast']);
  });

  it('cleans typed names the way the relay will, so what is sent is what it keeps', () => {
    seedMeal('  Tea </meals> with   milk  ', 'ok', at(10, 16, 0));

    expect(buildInsightRequest('day', entries())?.meals[0]?.name).toBe('Tea /meals with milk');
  });

  it('is null when there is nothing to summarise', () => {
    expect(buildInsightRequest('day', [])).toBeNull();
    createUncheckedMeal(db, { source: 'text', inputText: 'Banana bread', loggedAt: at(10, 15, 0) });
    expect(buildInsightRequest('day', entries())).toBeNull();
  });

  it('keeps within what the relay accepts: 60 meals, names under 100 characters', () => {
    for (let index = 0; index < 65; index += 1)
      seedMeal(`Meal ${index} ${'x'.repeat(120)}`, 'ok', at(10, 8, 0));

    const request = buildInsightRequest('day', entries());

    expect(request?.meals).toHaveLength(60);
    expect(request?.meals.every((meal) => meal.name.length <= 100)).toBe(true);
  });

  it('never carries notes or the portion', () => {
    const id = seedMeal('Mint tea', 'caution', at(10, 16, 0));
    createSymptomLog(db, {
      items: [{ key: 'heartburn' }],
      notes: 'private note about my day',
      foodLogId: id,
      loggedAt: at(10, 17, 0),
    });

    expect(JSON.stringify(buildInsightRequest('day', entries()))).not.toContain('private note');
  });
});

describe('insightHash', () => {
  const request: InsightRequest = {
    range: 'day',
    meals: [{ name: 'Mint tea', verdict: 'caution', when: '4:00 PM' }],
    symptoms: [],
    tags: [],
  };

  it('is the same for the same request and different when anything changes', () => {
    expect(insightHash(request)).toBe(insightHash({ ...request }));
    expect(insightHash(request)).toMatch(/^[0-9a-f]{8}$/);
    expect(insightHash({ ...request, range: 'week' })).not.toBe(insightHash(request));
    expect(insightHash({ ...request, tags: ['Stress'] })).not.toBe(insightHash(request));
    expect(insightHash({ ...request, meals: [{ ...request.meals[0]!, verdict: 'trigger' }] })).not.toBe(
      insightHash(request),
    );
  });
});

describe('fallbackInsight', () => {
  const meal = (verdict: InsightRequest['meals'][number]['verdict']) => ({
    name: 'A meal',
    verdict,
    when: '1:00 PM',
  });

  it('cheers a day of good meals with no symptoms', () => {
    const insight = fallbackInsight({
      range: 'day',
      meals: [meal('good'), meal('ok')],
      symptoms: [],
      tags: [],
    });

    expect(insight).toEqual({
      tone: 'cheer',
      bellieLine: 'A calm day so far!',
      summary: '2 meals today, all good.',
      tips: [],
    });
  });

  it('gives a gentle nudge and tips when a meal is a caution or trigger', () => {
    const insight = fallbackInsight({
      range: 'day',
      meals: [meal('ok'), meal('caution'), meal('trigger')],
      symptoms: [],
      tags: [],
    });

    expect(insight.tone).toBe('nudge');
    expect(insight.bellieLine).toBe('Go easy tonight?');
    expect(insight.summary).toBe('3 meals today: 1 good, 2 to watch.');
    expect(insight.tips.length).toBeGreaterThan(0);
  });

  it('mentions symptoms, with singular and plural words, and is gentle about them', () => {
    const one = fallbackInsight({
      range: 'day',
      meals: [meal('ok')],
      symptoms: [{ name: 'Heartburn', when: '9:00 PM' }],
      tags: [],
    });
    expect(one.bellieLine).toBe('Be gentle tonight.');
    expect(one.summary).toBe('1 meal today, all good. 1 symptom logged.');

    const two = fallbackInsight({
      range: 'week',
      meals: [],
      symptoms: [
        { name: 'Heartburn', when: 'Mon 9:00 PM' },
        { name: 'Burping', when: 'Tue 9:00 PM' },
      ],
      tags: [],
    });
    expect(two.summary).toBe('2 symptoms logged.');
    expect(two.bellieLine).toBe('A few bumps this week.');
  });

  it('talks about the week for a week', () => {
    const insight = fallbackInsight({ range: 'week', meals: [meal('good')], symptoms: [], tags: [] });

    expect(insight.bellieLine).toBe('A good week so far!');
    expect(insight.summary).toBe('1 meal this week, all good.');
  });

  it('is always a well-formed summary that makes no medical claims', () => {
    const insight = fallbackInsight({ range: 'day', meals: [meal('trigger')], symptoms: [], tags: [] });

    expect(isInsight(insight)).toBe(true);
    expect(insight.bellieLine.length).toBeLessThanOrEqual(40);
    expect(JSON.stringify(insight)).not.toMatch(/medic|diagnos|cure|treat/i);
  });
});

describe('isInsight', () => {
  const good = { tone: 'cheer', bellieLine: 'Hi', summary: 'All good.', tips: [] };

  it('accepts a well-formed summary', () => {
    expect(isInsight(good)).toBe(true);
    expect(isInsight({ ...good, tips: ['One idea.'] })).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'text'],
    ['a tone outside the set', { ...good, tone: 'angry' }],
    ['an empty line', { ...good, bellieLine: '' }],
    ['a missing summary', { tone: 'cheer', bellieLine: 'Hi', tips: [] }],
    ['tips that are not a list', { ...good, tips: 'x' }],
    ['tips that are not text', { ...good, tips: [1] }],
  ])('rejects %s', (_name, value) => {
    expect(isInsight(value)).toBe(false);
  });
});
