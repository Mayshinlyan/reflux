/** @jest-environment node */
import { count } from 'drizzle-orm';

import type { MealAnalysis } from '@/types/analysis';

import {
  createFoodLog,
  deleteFoodLog,
  getFoodLog,
  listDiaryFoodLogs,
  promoteCheckToDiary,
} from '../repositories/food';
import {
  archiveMedication,
  createMedication,
  listMedicationLogs,
  listMedications,
  logMedication,
  updateMedication,
} from '../repositories/medications';
import { DEFAULT_SETTINGS, getAllSettings, getSetting, setSetting } from '../repositories/settings';
import {
  createSymptomLog,
  deleteSymptomLog,
  getSymptomLog,
  listSymptomLogs,
  removeSymptomFromLog,
  removeTagFromLog,
  updateSymptomLog,
} from '../repositories/symptoms';
import { medicationLogs, medications, symptomLogItems, symptomLogTags } from '../schema';
import { createTestDb } from './testDb';

const DAY = { from: '2026-09-28T00:00:00.000Z', to: '2026-09-29T00:00:00.000Z' };

const mintTea: MealAnalysis = {
  isFood: true,
  mealName: 'Mint tea',
  items: [
    {
      name: 'Mint tea',
      ingredients: [{ name: 'Peppermint', matchedCategories: ['mint'] }],
      verdict: 'caution',
      reasoning: 'Peppermint can relax the valve that keeps acid down.',
      matchedTriggers: [{ category: 'mint', evidence: 'Peppermint' }],
    },
  ],
  overall: { verdict: 'caution', confidence: 'high', reasoning: 'Mint is a common trigger.' },
};
const meta = { model: 'claude-test', promptVersion: 'p1', rulesetVersion: 'r1' };

describe('settings', () => {
  it('returns defaults until a value is saved', () => {
    const { db } = createTestDb();
    expect(getAllSettings(db)).toEqual(DEFAULT_SETTINGS);
    expect(getSetting(db, 'bedtime')).toBe('22:30');
  });

  it('upserts values and keeps their types', () => {
    const { db } = createTestDb();
    setSetting(db, 'onboardingDone', true);
    setSetting(db, 'bedtime', '23:00');
    setSetting(db, 'bedtime', '21:45');
    setSetting(db, 'petName', '  Biscuit ');

    expect(getSetting(db, 'onboardingDone')).toBe(true);
    expect(getAllSettings(db)).toMatchObject({ bedtime: '21:45', petName: 'Biscuit', onboardingDone: true });
  });

  it('rejects invalid values', () => {
    const { db } = createTestDb();
    expect(() => setSetting(db, 'bedtime', '25:00')).toThrow();
    expect(() => setSetting(db, 'petName', '   ')).toThrow();
    expect(() => setSetting(db, 'petSeenStage', 3)).toThrow();
    expect(() => setSetting(db, 'petSeenStage', -1)).toThrow();
  });

  it('remembers the last pet stage the user saw, starting at 0', () => {
    const { db } = createTestDb();
    expect(getSetting(db, 'petSeenStage')).toBe(0);
    setSetting(db, 'petSeenStage', 2);
    expect(getSetting(db, 'petSeenStage')).toBe(2);
  });
});

describe('symptom logs', () => {
  it('stores symptoms and tags together and reads them back', () => {
    const { db } = createTestDb();
    const id = createSymptomLog(db, {
      items: [{ key: 'heartburn' }, { key: 'hoarseness' }],
      tags: ['large_meal', 'lay_down_after_eating'],
      notes: ' after dinner ',
      loggedAt: '2026-09-28T20:20:00.000Z',
      tz: 'Europe/London',
    });

    const log = getSymptomLog(db, id);
    expect(log).toMatchObject({ kind: 'quick', notes: 'after dinner', tz: 'Europe/London' });
    expect(log?.items).toEqual(
      expect.arrayContaining([
        { key: 'heartburn', score: 1 },
        { key: 'hoarseness', score: 1 },
      ]),
    );
    expect(log?.tags.sort()).toEqual(['large_meal', 'lay_down_after_eating']);
  });

  it('lists logs in a time range, oldest first', () => {
    const { db } = createTestDb();
    createSymptomLog(db, { items: [{ key: 'cough' }], loggedAt: '2026-09-28T21:00:00.000Z' });
    createSymptomLog(db, { items: [{ key: 'lump' }], loggedAt: '2026-09-28T08:00:00.000Z' });
    createSymptomLog(db, { items: [{ key: 'sleep' }], loggedAt: '2026-09-27T23:59:59.000Z' });

    const logs = listSymptomLogs(db, DAY);
    expect(logs.map((log) => log.items[0]?.key)).toEqual(['lump', 'cough']);
  });

  it('replaces items and tags on update', () => {
    const { db } = createTestDb();
    const id = createSymptomLog(db, { items: [{ key: 'heartburn' }], tags: ['stress'] });

    updateSymptomLog(db, id, { items: [{ key: 'mucus' }], tags: [] });

    expect(getSymptomLog(db, id)).toMatchObject({ items: [{ key: 'mucus' }], tags: [] });
  });

  it('deletes items and tags with the log (cascade)', () => {
    const { db } = createTestDb();
    const id = createSymptomLog(db, { items: [{ key: 'heartburn' }], tags: ['stress'] });

    deleteSymptomLog(db, id);

    expect(getSymptomLog(db, id)).toBeUndefined();
    expect(db.select({ n: count() }).from(symptomLogItems).get()?.n).toBe(0);
    expect(db.select({ n: count() }).from(symptomLogTags).get()?.n).toBe(0);
  });

  describe('removeTagFromLog', () => {
    it('takes one tag off and keeps the symptoms, other tags and note', () => {
      const { db } = createTestDb();
      const id = createSymptomLog(db, {
        items: [{ key: 'heartburn' }, { key: 'cough' }],
        tags: ['stress', 'large_meal'],
        notes: 'keep me',
      });

      removeTagFromLog(db, id, 'stress');

      expect(getSymptomLog(db, id)).toMatchObject({
        tags: ['large_meal'],
        notes: 'keep me',
        items: [
          { key: 'cough', score: 1 },
          { key: 'heartburn', score: 1 },
        ],
      });
    });

    it('lets the last tag go too, since tags are optional', () => {
      const { db } = createTestDb();
      const id = createSymptomLog(db, { items: [{ key: 'cough' }], tags: ['alcohol'] });

      removeTagFromLog(db, id, 'alcohol');

      expect(getSymptomLog(db, id)).toMatchObject({ tags: [], items: [{ key: 'cough' }] });
    });

    it('refuses a tag that is not on the entry, and only touches that entry', () => {
      const { db } = createTestDb();
      const a = createSymptomLog(db, { items: [{ key: 'cough' }], tags: ['stress'] });
      const b = createSymptomLog(db, { items: [{ key: 'cough' }], tags: ['stress'] });

      expect(() => removeTagFromLog(db, a, 'exercise')).toThrow(/not on this entry/);
      removeTagFromLog(db, a, 'stress');

      expect(getSymptomLog(db, a)?.tags).toEqual([]);
      expect(getSymptomLog(db, b)?.tags).toEqual(['stress']);
    });
  });

  describe('removeSymptomFromLog', () => {
    it('takes one symptom off and keeps everything else', () => {
      const { db } = createTestDb();
      const id = createSymptomLog(db, {
        items: [{ key: 'heartburn' }, { key: 'hoarseness' }, { key: 'feeling_full' }],
        tags: ['stress'],
        notes: 'keep me',
        loggedAt: '2026-09-28T20:20:00.000Z',
      });

      removeSymptomFromLog(db, id, 'heartburn');

      expect(getSymptomLog(db, id)).toMatchObject({
        items: [
          { key: 'hoarseness', score: 1 },
          { key: 'feeling_full', score: 1 },
        ],
        tags: ['stress'],
        notes: 'keep me',
        loggedAt: '2026-09-28T20:20:00.000Z',
      });
    });

    it('refuses to remove the last symptom, leaving the entry intact', () => {
      const { db } = createTestDb();
      const id = createSymptomLog(db, { items: [{ key: 'cough' }], notes: 'still here' });

      expect(() => removeSymptomFromLog(db, id, 'cough')).toThrow(/at least one symptom/);

      expect(getSymptomLog(db, id)).toMatchObject({ items: [{ key: 'cough' }], notes: 'still here' });
    });

    it('refuses a symptom that is not on the entry, and only touches that entry', () => {
      const { db } = createTestDb();
      const a = createSymptomLog(db, { items: [{ key: 'cough' }, { key: 'lump' }] });
      const b = createSymptomLog(db, { items: [{ key: 'cough' }, { key: 'lump' }] });

      expect(() => removeSymptomFromLog(db, a, 'heartburn')).toThrow(/not on this entry/);
      removeSymptomFromLog(db, a, 'cough');

      expect(getSymptomLog(db, a)?.items.map((item) => item.key)).toEqual(['lump']);
      expect(getSymptomLog(db, b)?.items.map((item) => item.key)).toEqual(['cough', 'lump']);
    });
  });

  it('rejects empty logs, unknown keys and duplicates', () => {
    const { db } = createTestDb();
    expect(() => createSymptomLog(db, { items: [] })).toThrow();
    // @ts-expect-error unknown key
    expect(() => createSymptomLog(db, { items: [{ key: 'nausea' }] })).toThrow();
    expect(() =>
      createSymptomLog(db, {
        items: [{ key: 'cough' }, { key: 'cough' }],
      }),
    ).toThrow();
  });

  it('is protected by CHECK constraints even if validation is bypassed', () => {
    const { sqlite } = createTestDb();
    sqlite.prepare("INSERT INTO symptom_logs (logged_at, tz) VALUES ('2026-09-28T08:00:00Z', 'UTC')").run();
    expect(() =>
      sqlite
        .prepare("INSERT INTO symptom_log_items (symptom_log_id, item_key, score) VALUES (1, 'cough', 9)")
        .run(),
    ).toThrow(/CHECK/);
  });
});

describe('food logs', () => {
  it('saves an analysis and lists only diary meals', () => {
    const { db } = createTestDb();
    const diaryId = createFoodLog(db, {
      entryType: 'diary',
      source: 'text',
      inputText: 'mint tea',
      analysis: mintTea,
      meta,
      loggedAt: '2026-09-28T19:45:00.000Z',
    });
    createFoodLog(db, { entryType: 'check', source: 'text', analysis: mintTea, meta, loggedAt: DAY.from });

    const diary = listDiaryFoodLogs(db, DAY);
    expect(diary).toHaveLength(1);
    expect(diary[0]).toMatchObject({ id: diaryId, mealName: 'Mint tea', overallVerdict: 'caution' });
    expect(diary[0]?.analysis.items[0]?.matchedTriggers[0]?.category).toBe('mint');
    expect(diary[0]?.analysisMeta).toEqual(meta);
  });

  it('promotes a check into the diary without changing the analysis', () => {
    const { db } = createTestDb();
    const id = createFoodLog(db, { entryType: 'check', source: 'text', analysis: mintTea, meta });

    promoteCheckToDiary(db, id, '2026-09-28T12:00:00.000Z');

    expect(getFoodLog(db, id)).toMatchObject({
      entryType: 'diary',
      loggedAt: '2026-09-28T12:00:00.000Z',
      analysis: mintTea,
    });
    expect(() => promoteCheckToDiary(db, id)).toThrow(); // already in the diary
  });

  it('promotes a check with a corrected analysis in the same update', () => {
    const { db } = createTestDb();
    const id = createFoodLog(db, { entryType: 'check', source: 'text', analysis: mintTea, meta });
    const chamomile: MealAnalysis = {
      ...mintTea,
      mealName: 'Chamomile tea',
      overall: { ...mintTea.overall, verdict: 'ok' },
    };
    const newMeta = { ...meta, promptVersion: 'p2' };

    promoteCheckToDiary(db, id, '2026-09-28T12:00:00.000Z', { analysis: chamomile, meta: newMeta });

    expect(getFoodLog(db, id)).toMatchObject({
      entryType: 'diary',
      mealName: 'Chamomile tea',
      overallVerdict: 'ok',
      analysis: chamomile,
      analysisMeta: newMeta,
    });
  });

  it('refuses to save non-food results and deletes meals', () => {
    const { db } = createTestDb();
    expect(() =>
      createFoodLog(db, {
        entryType: 'diary',
        source: 'photo',
        analysis: { ...mintTea, isFood: false },
        meta,
      }),
    ).toThrow();
    const id = createFoodLog(db, { entryType: 'diary', source: 'text', analysis: mintTea, meta });
    deleteFoodLog(db, id);
    expect(getFoodLog(db, id)).toBeUndefined();
  });
});

describe('medications', () => {
  it('logs a saved medication in one call, snapshotting name, type and dose', () => {
    const { db } = createTestDb();
    const medId = createMedication(db, { name: 'Omeprazole', type: 'ppi', defaultDose: '20mg' });
    logMedication(db, medId, { takenAt: '2026-09-28T08:00:00.000Z' });

    updateMedication(db, medId, { name: 'Omeprazole (generic)', type: 'ppi', defaultDose: '40mg' });

    expect(listMedicationLogs(db, DAY)).toEqual([
      expect.objectContaining({ medicationId: medId, name: 'Omeprazole', type: 'ppi', doseText: '20mg' }),
    ]);
  });

  it('hides archived medications from my meds but keeps them available', () => {
    const { db } = createTestDb();
    const tums = createMedication(db, { name: 'Tums', type: 'antacid' });
    createMedication(db, { name: 'Famotidine', type: 'h2_blocker', defaultDose: '20mg' });

    archiveMedication(db, tums);

    expect(listMedications(db).map((med) => med.name)).toEqual(['Famotidine']);
    expect(listMedications(db, { includeArchived: true })).toHaveLength(2);
  });

  it('keeps medication history when the saved medication is deleted', () => {
    const { db } = createTestDb();
    const medId = createMedication(db, { name: 'Gaviscon', type: 'alginate' });
    logMedication(db, medId, { takenAt: '2026-09-28T09:00:00.000Z' });

    db.delete(medications).run();

    const logs = db.select().from(medicationLogs).all();
    expect(logs).toEqual([expect.objectContaining({ medicationId: null, name: 'Gaviscon' })]);
  });

  it('rejects unknown types and blank names', () => {
    const { db } = createTestDb();
    // @ts-expect-error unknown type
    expect(() => createMedication(db, { name: 'X', type: 'vitamin' })).toThrow();
    expect(() => createMedication(db, { name: '  ', type: 'other' })).toThrow();
  });
});
