/** @jest-environment node */
import { count, eq } from 'drizzle-orm';

import { nowIso } from '@/lib/time';
import type { MealAnalysis } from '@/types/analysis';

import { countLoggedEntries, deleteAllData, earliestEntryDayKey } from '../repositories/data';
import { deleteEntry, restoreEntry } from '../repositories/entries';
import {
  countDiaryMeals,
  createFoodLog,
  createUncheckedMeal,
  deleteFoodLog,
  getFoodLog,
  isPendingCheck,
  listDiaryFoodLogs,
  listPendingChecks,
  listRecentMealNames,
  listMealTags,
  listMealTagsFor,
  promoteCheckToDiary,
  saveMealDetails,
  setMealAnalysis,
  setMealTime,
  updateFoodCheck,
  updateFoodLog,
} from '../repositories/food';
import {
  archiveMedication,
  createMedication,
  listMedicationLogs,
  listMedications,
  logMedication,
  updateMedication,
  updateMedicationLog,
} from '../repositories/medications';
import {
  createSavedFood,
  getSavedFood,
  isFoodSaved,
  listSavedFoods,
  logSavedFood,
  removeSavedFood,
  renameSavedFood,
  saveCheckedFood,
  saveFoodFromLog,
  updateSavedFood,
} from '../repositories/savedFoods';
import { DEFAULT_SETTINGS, getAllSettings, getSetting, setSetting } from '../repositories/settings';
import {
  createSymptomLog,
  deleteSymptomLog,
  getSymptomLog,
  listSymptomLogs,
  listSymptomLogsForMeal,
  removeSymptomFromLog,
  removeTagFromLog,
  setMealSymptoms,
  updateSymptomLog,
} from '../repositories/symptoms';
import {
  appSettings,
  foodLogs,
  foodLogTags,
  medicationLogs,
  medications,
  savedFoods,
  symptomLogItems,
  symptomLogs,
  symptomLogTags,
} from '../schema';
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

  it('starts Bellie as a Baby, stores a growth stage, and rejects anything else', () => {
    const { db } = createTestDb();
    expect(getSetting(db, 'bellieStageSeen')).toBe('baby');

    setSetting(db, 'bellieStageSeen', 'kid');
    expect(getSetting(db, 'bellieStageSeen')).toBe('kid');
    expect(() => setSetting(db, 'bellieStageSeen', 'toddler' as never)).toThrow('Unknown Bellie stage');
    expect(getSetting(db, 'bellieStageSeen')).toBe('kid');
  });

  it('has the check-in reminder off and unasked, stores the offered times, and rejects others', () => {
    const { db } = createTestDb();
    expect(getSetting(db, 'checkInReminderMinutes')).toBeNull();
    expect(getSetting(db, 'reminderAsked')).toBe(false);

    setSetting(db, 'checkInReminderMinutes', 120);
    setSetting(db, 'reminderAsked', true);
    expect(getAllSettings(db)).toMatchObject({ checkInReminderMinutes: 120, reminderAsked: true });

    setSetting(db, 'checkInReminderMinutes', null);
    expect(getSetting(db, 'checkInReminderMinutes')).toBeNull();

    expect(() => setSetting(db, 'checkInReminderMinutes', 45)).toThrow();
    expect(() => setSetting(db, 'checkInReminderMinutes', 0)).toThrow();
  });

  it('remembers that the app tour was seen, and starts out not having been', () => {
    const { db } = createTestDb();
    expect(getSetting(db, 'tourDone')).toBe(false);

    setSetting(db, 'tourDone', true);
    expect(getSetting(db, 'tourDone')).toBe(true);
    expect(getAllSettings(db).tourDone).toBe(true);
  });

  it('has no user name until one is set, then trims it and allows clearing it', () => {
    const { db } = createTestDb();
    expect(getSetting(db, 'userName')).toBe('');

    setSetting(db, 'userName', '  May ');
    expect(getSetting(db, 'userName')).toBe('May');

    setSetting(db, 'userName', '   ');
    expect(getSetting(db, 'userName')).toBe('');
  });

  it('defaults the avatar to the initial, stores a known one, and rejects an unknown key', () => {
    const { db } = createTestDb();
    expect(getSetting(db, 'avatar')).toBe('initial');

    setSetting(db, 'avatar', 'cat');
    expect(getSetting(db, 'avatar')).toBe('cat');

    expect(() => setSetting(db, 'avatar', 'dragon' as never)).toThrow();
  });

  it('stores the conditions and usual symptoms, and rejects unknown or duplicate ones', () => {
    const { db } = createTestDb();
    expect(getSetting(db, 'conditions')).toEqual(['unsure']);
    expect(getSetting(db, 'usualSymptoms')).toEqual([]);

    setSetting(db, 'conditions', ['acid_reflux', 'lpr']);
    setSetting(db, 'usualSymptoms', ['heartburn', 'hoarseness']);
    expect(getSetting(db, 'conditions')).toEqual(['acid_reflux', 'lpr']);
    expect(getSetting(db, 'usualSymptoms')).toEqual(['heartburn', 'hoarseness']);

    expect(() => setSetting(db, 'conditions', ['flu' as never])).toThrow();
    expect(() => setSetting(db, 'conditions', [])).toThrow();
    expect(() => setSetting(db, 'conditions', ['lpr', 'lpr'])).toThrow();
    expect(() => setSetting(db, 'conditions', ['unsure', 'lpr'])).toThrow();
    expect(() => setSetting(db, 'usualSymptoms', ['heartburn', 'heartburn'])).toThrow();
    expect(() => setSetting(db, 'usualSymptoms', ['nope' as never])).toThrow();
    expect(() => setSetting(db, 'usualSymptoms', ['sleep'])).toThrow();
  });

  it('carries a saved single condition over, with gerd becoming acid reflux', () => {
    const legacy = (value: string) => {
      const { db } = createTestDb();
      db.insert(appSettings)
        .values({ key: 'condition', value: JSON.stringify(value), updatedAt: nowIso() })
        .run();
      return db;
    };

    expect(getSetting(legacy('gerd'), 'conditions')).toEqual(['acid_reflux']);
    expect(getAllSettings(legacy('gerd')).conditions).toEqual(['acid_reflux']);
    expect(getAllSettings(legacy('lpr')).conditions).toEqual(['lpr']);
    expect(getAllSettings(legacy('flu')).conditions).toEqual(['unsure']);

    const db = legacy('gerd');
    setSetting(db, 'conditions', ['gastritis']);
    expect(getAllSettings(db).conditions).toEqual(['gastritis']);
  });

  it('cleans up a stored conditions row that is not a valid list', () => {
    const stored = (value: unknown) => {
      const { db } = createTestDb();
      db.insert(appSettings)
        .values({ key: 'conditions', value: JSON.stringify(value), updatedAt: nowIso() })
        .run();
      return db;
    };

    expect(getSetting(stored(['lpr', 'bogus', 'lpr']), 'conditions')).toEqual(['lpr']);
    expect(getAllSettings(stored(['lpr', 'bogus', 'lpr'])).conditions).toEqual(['lpr']);
    expect(getSetting(stored('not a list'), 'conditions')).toEqual(['unsure']);
    expect(getAllSettings(stored('not a list')).conditions).toEqual(['unsure']);
  });

  it('rejects invalid values', () => {
    const { db } = createTestDb();
    expect(() => setSetting(db, 'userName', 'x'.repeat(25))).toThrow();
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

  it('links symptoms to the meal they followed, and keeps them when that meal is deleted', () => {
    const { db } = createTestDb();
    const mealId = createUncheckedMeal(db, { source: 'text', inputText: 'rice' });
    const id = createSymptomLog(db, { items: [{ key: 'burping' }], foodLogId: mealId });

    expect(getSymptomLog(db, id)?.foodLogId).toBe(mealId);
    updateSymptomLog(db, id, { items: [{ key: 'burping' }, { key: 'feeling_full' }] });
    expect(getSymptomLog(db, id)?.foodLogId).toBe(mealId);

    deleteFoodLog(db, mealId);

    expect(getSymptomLog(db, id)).toMatchObject({
      foodLogId: null,
      items: [{ key: 'burping' }, { key: 'feeling_full' }],
    });
  });

  it('sets or takes off the meal link on update, and leaves it when none is given', () => {
    const { db } = createTestDb();
    const mealId = createUncheckedMeal(db, { source: 'text', inputText: 'rice' });
    const id = createSymptomLog(db, { items: [{ key: 'burping' }] });
    expect(getSymptomLog(db, id)?.foodLogId).toBeNull();

    updateSymptomLog(db, id, { items: [{ key: 'burping' }], foodLogId: mealId });
    expect(getSymptomLog(db, id)?.foodLogId).toBe(mealId);

    updateSymptomLog(db, id, { items: [{ key: 'burping' }], foodLogId: null });
    expect(getSymptomLog(db, id)?.foodLogId).toBeNull();
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

    it('lets the last symptom go when the entry has lifestyle tags, leaving a lifestyle-only entry', () => {
      const { db } = createTestDb();
      const id = createSymptomLog(db, { items: [{ key: 'cough' }], tags: ['stress'], notes: 'still here' });

      removeSymptomFromLog(db, id, 'cough');

      expect(getSymptomLog(db, id)).toMatchObject({ items: [], tags: ['stress'], notes: 'still here' });
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

  it('keeps a lifestyle-only check-in: no symptoms, one or more factors, and reads it back', () => {
    const { db } = createTestDb();
    const id = createSymptomLog(db, { items: [], tags: ['stress', 'custom:Skipped breakfast'] });
    const log = getSymptomLog(db, id);
    expect(log?.items).toEqual([]);
    expect(log?.tags.sort()).toEqual(['custom:Skipped breakfast', 'stress']);

    // It can be edited, and gain symptoms; one with neither symptoms nor factors is still refused.
    updateSymptomLog(db, id, { items: [], tags: ['alcohol'] });
    expect(getSymptomLog(db, id)?.tags).toEqual(['alcohol']);
    expect(() => updateSymptomLog(db, id, { items: [], tags: [] })).toThrow(/symptom or a lifestyle factor/);
    updateSymptomLog(db, id, { items: [{ key: 'cough' }], tags: ['alcohol'] });
    expect(getSymptomLog(db, id)?.items.map((item) => item.key)).toEqual(['cough']);
  });

  it('rejects empty logs, unknown keys and duplicates', () => {
    const { db } = createTestDb();
    expect(() => createSymptomLog(db, { items: [] })).toThrow(/symptom or a lifestyle factor/);
    expect(() => createSymptomLog(db, { items: [], tags: [] })).toThrow(/symptom or a lifestyle factor/);
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

describe('symptoms after a meal', () => {
  const MANAGED = ['heartburn', 'burping', 'hoarseness', 'stomach_pain'] as const;
  const AT = '2026-09-28T20:30:00.000Z';
  const meal = (db: ReturnType<typeof createTestDb>['db']) =>
    createFoodLog(db, {
      entryType: 'diary',
      source: 'text',
      analysis: mintTea,
      meta,
      loggedAt: '2026-09-28T19:45:00.000Z',
    });

  it('lists the logs linked to a meal and no others', () => {
    const { db } = createTestDb();
    const mealId = meal(db);
    const linked = createSymptomLog(db, { items: [{ key: 'heartburn' }], foodLogId: mealId, loggedAt: AT });
    createSymptomLog(db, { items: [{ key: 'cough' }], loggedAt: AT });

    expect(listSymptomLogsForMeal(db, mealId).map((log) => log.id)).toEqual([linked]);
  });

  it('adds new symptoms in one linked log and takes unwanted ones off', () => {
    const { db } = createTestDb();
    const mealId = meal(db);
    setMealSymptoms(db, mealId, ['heartburn', 'burping'], MANAGED, AT);
    expect(listSymptomLogsForMeal(db, mealId)).toHaveLength(1);

    setMealSymptoms(db, mealId, ['burping', 'hoarseness'], MANAGED, AT);
    const keys = listSymptomLogsForMeal(db, mealId).flatMap((log) => log.items.map((item) => item.key));
    expect(keys.sort()).toEqual(['burping', 'hoarseness']);
  });

  it('deletes a log left with nothing, and clears everything when none are wanted', () => {
    const { db } = createTestDb();
    const mealId = meal(db);
    setMealSymptoms(db, mealId, ['heartburn'], MANAGED, AT);
    setMealSymptoms(db, mealId, [], MANAGED, AT);

    expect(listSymptomLogsForMeal(db, mealId)).toEqual([]);
    expect(db.select().from(symptomLogs).all()).toHaveLength(0);
  });

  it('keeps a log that still has lifestyle tags when all its symptoms are cleared', () => {
    const { db } = createTestDb();
    const mealId = meal(db);
    const id = createSymptomLog(db, {
      items: [{ key: 'heartburn' }],
      tags: ['stress'],
      foodLogId: mealId,
      loggedAt: AT,
    });
    setMealSymptoms(db, mealId, [], MANAGED, AT);

    expect(getSymptomLog(db, id)).toMatchObject({ items: [], tags: ['stress'] });
  });

  it('leaves symptoms the meal screen cannot show alone', () => {
    const { db } = createTestDb();
    const mealId = meal(db);
    const id = createSymptomLog(db, {
      items: [{ key: 'heartburn' }, { key: 'cough' }],
      foodLogId: mealId,
      loggedAt: AT,
    });
    setMealSymptoms(db, mealId, [], MANAGED, AT);

    expect(getSymptomLog(db, id)?.items.map((item) => item.key)).toEqual(['cough']);
  });

  it('changes nothing when the selection is the same', () => {
    const { db } = createTestDb();
    const mealId = meal(db);
    const id = createSymptomLog(db, { items: [{ key: 'heartburn' }], foodLogId: mealId, loggedAt: AT });
    setMealSymptoms(db, mealId, ['heartburn'], MANAGED, AT);

    expect(listSymptomLogsForMeal(db, mealId).map((log) => log.id)).toEqual([id]);
  });
});

describe('earliestEntryDayKey', () => {
  it('is undefined when nothing is logged', () => {
    const { db } = createTestDb();
    expect(earliestEntryDayKey(db)).toBeUndefined();
  });

  it('is the oldest day across meals, symptoms and doses, in the zone each was logged in', () => {
    const { db } = createTestDb();
    createFoodLog(db, {
      entryType: 'diary',
      source: 'text',
      analysis: mintTea,
      meta,
      loggedAt: '2026-09-20T12:00:00.000Z',
      tz: 'UTC',
    });
    createSymptomLog(db, { items: [{ key: 'cough' }], loggedAt: '2026-09-10T12:00:00.000Z', tz: 'UTC' });
    const medId = createMedication(db, { name: 'Omeprazole', type: 'ppi' });
    logMedication(db, medId, { takenAt: '2026-09-15T12:00:00.000Z' });
    // A check isn't a diary entry, however old.
    createFoodLog(db, {
      entryType: 'check',
      source: 'text',
      analysis: mintTea,
      meta,
      loggedAt: '2026-01-01T12:00:00.000Z',
    });

    expect(earliestEntryDayKey(db)).toBe('2026-09-10');
  });

  it('compares local days, so a late-evening entry in a far zone can be the earlier day', () => {
    const { db } = createTestDb();
    // 23:30 UTC on the 9th is already the 10th in Tokyo; 01:00 UTC on the 10th is still the 9th in LA.
    createSymptomLog(db, {
      items: [{ key: 'cough' }],
      loggedAt: '2026-09-09T23:30:00.000Z',
      tz: 'Asia/Tokyo',
    });
    createSymptomLog(db, {
      items: [{ key: 'cough' }],
      loggedAt: '2026-09-10T01:00:00.000Z',
      tz: 'America/Los_Angeles',
    });

    expect(earliestEntryDayKey(db)).toBe('2026-09-09');
  });
});

describe('isFoodSaved', () => {
  it('matches a saved food by name, ignoring case', () => {
    const { db } = createTestDb();
    createSavedFood(db, 'Mint tea');

    expect(isFoodSaved(db, 'mint TEA')).toBe(true);
    expect(isFoodSaved(db, 'Oatmeal')).toBe(false);
  });
});

describe('listRecentMealNames', () => {
  const named = (mealName: string): MealAnalysis => ({ ...mintTea, mealName });

  it('lists each diary meal name once, the most recent first, and leaves out checks and unnamed meals', () => {
    const { db } = createTestDb();
    const log = (entryType: 'diary' | 'check', mealName: string, loggedAt: string) =>
      createFoodLog(db, { entryType, source: 'text', analysis: named(mealName), meta, loggedAt });
    log('diary', 'Oatmeal', '2026-09-26T08:00:00.000Z');
    log('diary', 'Mint tea', '2026-09-27T08:00:00.000Z');
    log('diary', 'oatmeal', '2026-09-28T08:00:00.000Z');
    log('check', 'Pizza', '2026-09-29T08:00:00.000Z');
    createUncheckedMeal(db, { source: 'photo', loggedAt: '2026-09-29T09:00:00.000Z' });

    expect(listRecentMealNames(db)).toEqual(['oatmeal', 'Mint tea']);
  });

  it('stops at the limit and is empty with no meals', () => {
    const { db } = createTestDb();
    expect(listRecentMealNames(db)).toEqual([]);
    for (const name of ['A', 'B', 'C']) createUncheckedMeal(db, { source: 'text', inputText: name });
    expect(listRecentMealNames(db, 2)).toHaveLength(2);
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
    expect(diary[0]?.analysis?.items[0]?.matchedTriggers[0]?.category).toBe('mint');
    expect(diary[0]?.analysisMeta).toEqual(meta);
  });

  it('counts diary meals only, across all days', () => {
    const { db } = createTestDb();
    expect(countDiaryMeals(db)).toBe(0);

    createFoodLog(db, { entryType: 'diary', source: 'text', analysis: mintTea, meta, loggedAt: DAY.from });
    createFoodLog(db, {
      entryType: 'diary',
      source: 'text',
      analysis: mintTea,
      meta,
      loggedAt: '2026-01-02T08:00:00.000Z',
    });
    createFoodLog(db, { entryType: 'check', source: 'text', analysis: mintTea, meta, loggedAt: DAY.from });

    expect(countDiaryMeals(db)).toBe(2);
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

  it("updates a check's verdict, but never a diary meal's", () => {
    const { db } = createTestDb();
    const id = createFoodLog(db, { entryType: 'check', source: 'text', analysis: mintTea, meta });
    const chamomile: MealAnalysis = {
      ...mintTea,
      mealName: 'Chamomile tea',
      overall: { ...mintTea.overall, verdict: 'ok' },
    };
    const newMeta = { ...meta, promptVersion: 'p2' };

    updateFoodCheck(db, id, { analysis: chamomile, meta: newMeta });

    expect(getFoodLog(db, id)).toMatchObject({
      entryType: 'check',
      mealName: 'Chamomile tea',
      overallVerdict: 'ok',
      analysis: chamomile,
      analysisMeta: newMeta,
    });

    promoteCheckToDiary(db, id);
    expect(() => updateFoodCheck(db, id, { analysis: mintTea, meta })).toThrow();
    expect(getFoodLog(db, id)?.mealName).toBe('Chamomile tea');
  });

  it('saves details after a verdict: time, portion, tags and note, replacing earlier tags', () => {
    const { db } = createTestDb();
    const id = createFoodLog(db, { entryType: 'check', source: 'text', analysis: mintTea, meta });
    promoteCheckToDiary(db, id);

    saveMealDetails(db, id, {
      loggedAt: '2026-09-28T19:45:00.000Z',
      portion: 'large',
      tags: ['stress', 'large_meal', 'stress'],
      notes: '  felt heavy  ',
    });
    expect(getFoodLog(db, id)).toMatchObject({
      loggedAt: '2026-09-28T19:45:00.000Z',
      portion: 'large',
      notes: 'felt heavy',
    });
    expect(listMealTags(db, id).sort()).toEqual(['large_meal', 'stress']);

    saveMealDetails(db, id, { portion: 'regular', tags: [], notes: '' });
    expect(getFoodLog(db, id)).toMatchObject({
      loggedAt: '2026-09-28T19:45:00.000Z',
      portion: null,
      notes: null,
    });
    expect(listMealTags(db, id)).toEqual([]);
  });

  it('reads the tags of several meals at once, leaving out meals without tags', () => {
    const { db } = createTestDb();
    const [a, b, c] = ['a', 'b', 'c'].map((name) =>
      createFoodLog(db, {
        entryType: 'diary',
        source: 'text',
        inputText: name,
        analysis: mintTea,
        meta,
      }),
    ) as [number, number, number];
    saveMealDetails(db, a, { tags: ['stress', 'alcohol'] });
    saveMealDetails(db, b, { tags: ['stress'] });

    const tags = listMealTagsFor(db, [a, b, c]);
    expect([...(tags.get(a) ?? [])].sort()).toEqual(['alcohol', 'stress']);
    expect(tags.get(b)).toEqual(['stress']);
    expect(tags.has(c)).toBe(false);
    expect(listMealTagsFor(db, []).size).toBe(0);
  });

  it('keeps a lifestyle factor the user typed as a custom tag on the meal, and refuses a malformed one', () => {
    const { db } = createTestDb();
    const id = createFoodLog(db, { entryType: 'diary', source: 'text', analysis: mintTea, meta });
    saveMealDetails(db, id, { tags: ['stress', 'custom:Skipped breakfast'] });
    expect(listMealTags(db, id).sort()).toEqual(['custom:Skipped breakfast', 'stress']);
    expect(listMealTagsFor(db, [id]).get(id)?.sort()).toEqual(['custom:Skipped breakfast', 'stress']);

    expect(() => saveMealDetails(db, id, { tags: ['custom:'] })).toThrow('Invalid custom tag');
    expect(() => saveMealDetails(db, id, { tags: ['custom:  padded '] })).toThrow('Invalid custom tag');
    // A failed save changes nothing.
    expect(listMealTags(db, id).sort()).toEqual(['custom:Skipped breakfast', 'stress']);
  });

  it('does not touch the portion when the details leave it out', () => {
    const { db } = createTestDb();
    const id = createFoodLog(db, {
      entryType: 'diary',
      source: 'text',
      analysis: mintTea,
      meta,
      portion: 'large',
    });
    saveMealDetails(db, id, { tags: ['stress'], notes: 'heavy' });
    expect(getFoodLog(db, id)).toMatchObject({ portion: 'large', notes: 'heavy' });
  });

  it('refuses unknown tags and missing meals when saving details', () => {
    const { db } = createTestDb();
    const id = createFoodLog(db, { entryType: 'diary', source: 'text', analysis: mintTea, meta });
    expect(() => saveMealDetails(db, id, { tags: ['nope' as never] })).toThrow();
    expect(() => saveMealDetails(db, 999, {})).toThrow();
  });

  it('deletes meal tags with the meal (cascade)', () => {
    const { db } = createTestDb();
    const id = createFoodLog(db, { entryType: 'diary', source: 'text', analysis: mintTea, meta });
    saveMealDetails(db, id, { tags: ['alcohol'] });
    deleteFoodLog(db, id);
    expect(db.select({ n: count() }).from(foodLogTags).get()?.n).toBe(0);
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

describe('unchecked meals', () => {
  it('saves a typed meal to the diary with no verdict, analysis or meta', () => {
    const { db } = createTestDb();
    const id = createUncheckedMeal(db, { source: 'text', inputText: '  toast and eggs ' });

    expect(getFoodLog(db, id)).toMatchObject({
      entryType: 'diary',
      source: 'text',
      inputText: 'toast and eggs',
      mealName: 'toast and eggs',
      overallVerdict: null,
      analysis: null,
      analysisMeta: null,
    });
    expect(listDiaryFoodLogs(db, { from: '2000-01-01', to: '2100-01-01' })).toHaveLength(1);
  });

  it('names a photo meal "Meal" and keeps its photo', () => {
    const { db } = createTestDb();
    const id = createUncheckedMeal(db, { source: 'photo', photoUri: 'file:///p.jpg' });

    expect(getFoodLog(db, id)).toMatchObject({
      mealName: 'Meal',
      photoUri: 'file:///p.jpg',
      inputText: null,
    });
  });
});

describe('updateFoodLog', () => {
  const diaryMeal = (db: ReturnType<typeof createTestDb>['db']) =>
    createFoodLog(db, {
      entryType: 'diary',
      source: 'text',
      inputText: 'mint tea',
      analysis: mintTea,
      meta,
      loggedAt: '2020-01-01T08:00:00.000Z',
      tz: 'Asia/Tokyo',
    });

  it('stores the portion it was checked with, regular as null', () => {
    const { db } = createTestDb();
    const large = createFoodLog(db, {
      entryType: 'diary',
      source: 'text',
      analysis: mintTea,
      meta,
      portion: 'large',
    });
    const regular = createFoodLog(db, {
      entryType: 'diary',
      source: 'text',
      analysis: mintTea,
      meta,
      portion: 'regular',
    });
    const unchecked = createUncheckedMeal(db, { source: 'text', inputText: 'toast', portion: 'small' });

    expect(getFoodLog(db, large)?.portion).toBe('large');
    expect(getFoodLog(db, regular)?.portion).toBeNull();
    expect(getFoodLog(db, unchecked)?.portion).toBe('small');
  });

  it('renames, moves the time (in the current zone) and changes the portion', () => {
    const { db } = createTestDb();
    const id = diaryMeal(db);

    updateFoodLog(db, id, {
      name: '  Peppermint tea ',
      loggedAt: '2020-01-02T09:00:00.000Z',
      portion: 'small',
    });

    const log = getFoodLog(db, id);
    expect(log).toMatchObject({
      mealName: 'Peppermint tea',
      loggedAt: '2020-01-02T09:00:00.000Z',
      portion: 'small',
    });
    expect(log?.tz).not.toBe('Asia/Tokyo');
    expect(log?.analysis).toEqual(mintTea);
  });

  it('keeps the time and zone when no time is given', () => {
    const { db } = createTestDb();
    const id = diaryMeal(db);
    updateFoodLog(db, id, { name: 'Mint tea' });
    expect(getFoodLog(db, id)).toMatchObject({ loggedAt: '2020-01-01T08:00:00.000Z', tz: 'Asia/Tokyo' });
  });

  it('stores a verdict chosen by hand in the analysis and the verdict column', () => {
    const { db } = createTestDb();
    const id = diaryMeal(db);

    updateFoodLog(db, id, { name: 'Mint tea', verdict: 'good' });

    const log = getFoodLog(db, id);
    expect(log?.overallVerdict).toBe('good');
    expect(log?.analysis?.overall).toMatchObject({ verdict: 'caution', userVerdict: 'good' });
  });

  it('replaces the verdict with a new check', () => {
    const { db } = createTestDb();
    const id = diaryMeal(db);
    const bigger = { ...mintTea, overall: { ...mintTea.overall, verdict: 'trigger' as const } };

    updateFoodLog(db, id, { name: 'Mint tea', portion: 'large', check: { analysis: bigger, meta } });

    expect(getFoodLog(db, id)).toMatchObject({
      overallVerdict: 'trigger',
      analysis: bigger,
      portion: 'large',
    });
  });

  it('only edits diary meals, and needs a name', () => {
    const { db } = createTestDb();
    const check = createFoodLog(db, { entryType: 'check', source: 'text', analysis: mintTea, meta });
    expect(() => updateFoodLog(db, check, { name: 'x' })).toThrow('not found');
    expect(() => updateFoodLog(db, 999, { name: 'x' })).toThrow('not found');
    expect(() => updateFoodLog(db, diaryMeal(db), { name: '  ' })).toThrow('name');
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

  it('lists medications A to Z regardless of case', () => {
    const { db } = createTestDb();
    createMedication(db, { name: 'Tums', type: 'antacid' });
    createMedication(db, { name: 'allergy pill', type: 'other' });
    createMedication(db, { name: 'Famotidine', type: 'h2_blocker' });

    expect(listMedications(db).map((med) => med.name)).toEqual(['allergy pill', 'Famotidine', 'Tums']);
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

  it('moves a past dose to a new time, in the current zone', () => {
    const { db } = createTestDb();
    const medId = createMedication(db, { name: 'Omeprazole', type: 'ppi', defaultDose: '20mg' });
    const logId = logMedication(db, medId, { takenAt: '2020-01-01T08:00:00.000Z', tz: 'Asia/Tokyo' });

    updateMedicationLog(db, logId, {
      takenAt: '2020-01-01T06:30:00.000Z',
      doseText: ' 40mg ',
      notes: 'With breakfast',
    });

    const [log] = db.select().from(medicationLogs).all();
    expect(log).toMatchObject({
      id: logId,
      takenAt: '2020-01-01T06:30:00.000Z',
      name: 'Omeprazole',
      doseText: '40mg',
      notes: 'With breakfast',
    });
    expect(log.tz).not.toBe('Asia/Tokyo');
  });

  it('keeps the time when none is given, and clears a blank dose and note', () => {
    const { db } = createTestDb();
    const medId = createMedication(db, { name: 'Omeprazole', type: 'ppi', defaultDose: '20mg' });
    const logId = logMedication(db, medId, {
      takenAt: '2020-01-01T08:00:00.000Z',
      tz: 'Asia/Tokyo',
      notes: 'old',
    });

    updateMedicationLog(db, logId, { doseText: '  ', notes: '' });

    const [log] = db.select().from(medicationLogs).all();
    expect(log).toMatchObject({
      takenAt: '2020-01-01T08:00:00.000Z',
      tz: 'Asia/Tokyo',
      doseText: null,
      notes: null,
    });
  });

  it('throws when editing a dose that does not exist', () => {
    const { db } = createTestDb();
    expect(() => updateMedicationLog(db, 999, { doseText: '', notes: '' })).toThrow('not found');
  });

  it('rejects unknown types and blank names', () => {
    const { db } = createTestDb();
    // @ts-expect-error unknown type
    expect(() => createMedication(db, { name: 'X', type: 'vitamin' })).toThrow();
    expect(() => createMedication(db, { name: '  ', type: 'other' })).toThrow();
  });
});

describe('saved foods (Favorite foods)', () => {
  it('saves a logged meal with its verdict and photo, and logs it again without a relay call', () => {
    const { db } = createTestDb();
    const logId = createFoodLog(db, {
      entryType: 'diary',
      source: 'photo',
      photoUri: 'file:///p.jpg',
      analysis: mintTea,
      meta,
      loggedAt: '2020-01-01T08:00:00.000Z',
    });

    const saved = saveFoodFromLog(db, logId);
    expect(saved.created).toBe(true);
    expect(listSavedFoods(db)).toEqual([
      expect.objectContaining({
        id: saved.id,
        source: 'photo',
        photoUri: 'file:///p.jpg',
        mealName: 'Mint tea',
        overallVerdict: 'caution',
        analysis: mintTea,
      }),
    ]);

    const copy = getFoodLog(db, logSavedFood(db, saved.id));
    expect(copy).toMatchObject({
      entryType: 'diary',
      photoUri: 'file:///p.jpg',
      mealName: 'Mint tea',
      overallVerdict: 'caution',
      analysis: mintTea,
    });
    expect(copy!.loggedAt > '2020-01-01T08:00:00.000Z').toBe(true);
  });

  it("doesn't save the same meal twice, ignoring case", () => {
    const { db } = createTestDb();
    const first = createFoodLog(db, { entryType: 'diary', source: 'text', analysis: mintTea, meta });
    const second = createFoodLog(db, {
      entryType: 'diary',
      source: 'text',
      analysis: { ...mintTea, mealName: 'MINT TEA' },
      meta,
    });

    const one = saveFoodFromLog(db, first);
    const two = saveFoodFromLog(db, second);

    expect(two).toEqual({ id: one.id, created: false });
    expect(listSavedFoods(db)).toHaveLength(1);
  });

  it('adds a food by name; logging it saves a meal without a verdict', () => {
    const { db } = createTestDb();
    const id = createSavedFood(db, '  Oatmeal ');

    expect(listSavedFoods(db)[0]).toMatchObject({
      mealName: 'Oatmeal',
      overallVerdict: null,
      analysis: null,
    });
    expect(getFoodLog(db, logSavedFood(db, id))).toMatchObject({
      entryType: 'diary',
      source: 'text',
      inputText: 'Oatmeal',
      mealName: 'Oatmeal',
      overallVerdict: null,
      analysis: null,
    });
    expect(() => createSavedFood(db, '   ')).toThrow();
  });

  it('edits a saved food: name and photo, ingredients alone, or a new check', () => {
    const { db } = createTestDb();
    const meta = { model: 'm', promptVersion: 'p', rulesetVersion: 'r' };
    const id = saveCheckedFood(db, { source: 'text', inputText: 'mint tea', analysis: mintTea, meta }).id;

    updateSavedFood(db, id, { name: ' Tea ', photoUri: 'file:///new.jpg' });
    expect(getSavedFood(db, id)).toMatchObject({ mealName: 'Tea', photoUri: 'file:///new.jpg' });

    // New ingredients change the list only; the verdict is stale until checked again.
    updateSavedFood(db, id, { name: 'Tea', ingredients: ['Honey'] });
    const edited = getSavedFood(db, id);
    expect(edited?.analysis?.items[0].ingredients.map((i) => i.name)).toEqual(['Honey']);
    expect(edited?.overallVerdict).toBe(mintTea.overall.verdict);
    expect(edited?.photoUri).toBe('file:///new.jpg');

    const fresh = { ...mintTea, overall: { ...mintTea.overall, verdict: 'ok' as const } };
    updateSavedFood(db, id, { name: 'Tea', check: { analysis: fresh, meta } });
    expect(getSavedFood(db, id)).toMatchObject({ overallVerdict: 'ok', analysis: fresh });

    expect(() => updateSavedFood(db, id, { name: ' ' })).toThrow();
    expect(() => updateSavedFood(db, 999, { name: 'X' })).toThrow();
  });

  it("sets a verdict by hand over the AI's, and keeps both", () => {
    const { db } = createTestDb();
    const meta = { model: 'm', promptVersion: 'p', rulesetVersion: 'r' };
    const id = saveCheckedFood(db, { source: 'text', inputText: 'mint tea', analysis: mintTea, meta }).id;
    const aiVerdict = mintTea.overall.verdict;

    updateSavedFood(db, id, { name: 'Mint tea', verdict: 'good' });
    const mine = getSavedFood(db, id);
    expect(mine?.overallVerdict).toBe('good');
    expect(mine?.analysis?.overall).toMatchObject({
      verdict: aiVerdict,
      userVerdict: 'good',
      reasoning: mintTea.overall.reasoning,
    });

    // Logging it carries the verdict that applies.
    expect(getFoodLog(db, logSavedFood(db, id))?.overallVerdict).toBe('good');

    // Choosing the AI's own verdict again clears the override.
    updateSavedFood(db, id, { name: 'Mint tea', verdict: aiVerdict });
    expect(getSavedFood(db, id)?.overallVerdict).toBe(aiVerdict);
    expect(getSavedFood(db, id)?.analysis?.overall.userVerdict).toBeUndefined();

    // A new check replaces the user's choice with the new AI verdict, unless one is chosen on top of it.
    updateSavedFood(db, id, { name: 'Mint tea', verdict: 'good' });
    const fresh = { ...mintTea, overall: { ...mintTea.overall, verdict: 'ok' as const } };
    updateSavedFood(db, id, { name: 'Mint tea', check: { analysis: fresh, meta } });
    expect(getSavedFood(db, id)).toMatchObject({ overallVerdict: 'ok', analysis: fresh });
    updateSavedFood(db, id, { name: 'Mint tea', check: { analysis: fresh, meta }, verdict: 'trigger' });
    expect(getSavedFood(db, id)?.overallVerdict).toBe('trigger');

    // Editing ingredients keeps the user's verdict.
    updateSavedFood(db, id, { name: 'Mint tea', ingredients: ['Honey'] });
    expect(getSavedFood(db, id)?.overallVerdict).toBe('trigger');
    expect(getSavedFood(db, id)?.analysis?.overall.userVerdict).toBe('trigger');
  });

  it('lists A to Z ignoring case, renames, and removes without touching History', () => {
    const { db } = createTestDb();
    const banana = createSavedFood(db, 'banana');
    createSavedFood(db, 'Apple');
    const logId = logSavedFood(db, banana);

    expect(listSavedFoods(db).map((f) => f.mealName)).toEqual(['Apple', 'banana']);
    renameSavedFood(db, banana, 'Banana bread');
    expect(listSavedFoods(db).map((f) => f.mealName)).toEqual(['Apple', 'Banana bread']);
    expect(() => renameSavedFood(db, banana, ' ')).toThrow();
    expect(() => renameSavedFood(db, 999, 'X')).toThrow();

    removeSavedFood(db, banana);
    expect(listSavedFoods(db).map((f) => f.mealName)).toEqual(['Apple']);
    expect(getFoodLog(db, logId)).toMatchObject({ mealName: 'banana' });
  });

  it('saves a checked food without logging it, and merges a same-name food', () => {
    const { db } = createTestDb();
    const added = saveCheckedFood(db, {
      source: 'photo',
      photoUri: 'file:///p.jpg',
      analysis: mintTea,
      meta,
    });
    expect(added.created).toBe(true);
    expect(getSavedFood(db, added.id)).toMatchObject({
      source: 'photo',
      photoUri: 'file:///p.jpg',
      mealName: 'Mint tea',
      overallVerdict: 'caution',
      analysis: mintTea,
    });
    expect(db.select().from(foodLogs).all()).toHaveLength(0);

    const again = saveCheckedFood(db, {
      source: 'text',
      inputText: 'mint tea',
      analysis: { ...mintTea, mealName: 'MINT TEA' },
      meta,
    });
    expect(again).toEqual({ id: added.id, created: false, mealName: 'Mint tea' });
    expect(listSavedFoods(db)).toHaveLength(1);
    // A text check keeps the photo.
    expect(getSavedFood(db, added.id)).toMatchObject({ mealName: 'Mint tea', photoUri: 'file:///p.jpg' });
  });

  it('gives a food added by name a verdict, keeping its name', () => {
    const { db } = createTestDb();
    const id = createSavedFood(db, 'My tea');

    expect(saveCheckedFood(db, { id, source: 'text', inputText: 'My tea', analysis: mintTea, meta })).toEqual(
      {
        id,
        created: false,
        mealName: 'My tea',
      },
    );
    expect(getSavedFood(db, id)).toMatchObject({ mealName: 'My tea', overallVerdict: 'caution' });
    expect(() => saveCheckedFood(db, { id: 999, source: 'text', analysis: mintTea, meta })).toThrow();
    expect(getSavedFood(db, 999)).toBeNull();
  });

  it('throws for a missing meal or saved food', () => {
    const { db } = createTestDb();
    expect(() => saveFoodFromLog(db, 999)).toThrow();
    expect(() => logSavedFood(db, 999)).toThrow();
  });
});

describe('delete all data', () => {
  const seed = (db: ReturnType<typeof createTestDb>['db']) => {
    createSymptomLog(db, {
      items: [{ key: 'heartburn' }],
      tags: ['large_meal'],
      loggedAt: '2026-09-28T20:20:00.000Z',
      tz: 'Europe/London',
    });
    const taggedId = createFoodLog(db, {
      entryType: 'diary',
      source: 'text',
      inputText: 'mint tea',
      analysis: mintTea,
      meta,
    });
    saveMealDetails(db, taggedId, { tags: ['stress'], notes: 'heavy' });
    createFoodLog(db, {
      entryType: 'check',
      source: 'photo',
      photoUri: 'file:///p.jpg',
      analysis: mintTea,
      meta,
    });
    const medId = createMedication(db, { name: 'Omeprazole', type: 'ppi' });
    logMedication(db, medId, { takenAt: '2026-09-28T07:00:00.000Z', tz: 'Europe/London' });
    createSavedFood(db, 'Oatmeal');
    setSetting(db, 'onboardingDone', true);
    setSetting(db, 'petName', 'Biscuit');
    setSetting(db, 'bedtime', '23:30');
    setSetting(db, 'petSeenStage', 2);
  };
  const rows = (db: ReturnType<typeof createTestDb>['db']) =>
    [
      symptomLogs,
      symptomLogItems,
      symptomLogTags,
      foodLogs,
      foodLogTags,
      medications,
      medicationLogs,
      savedFoods,
    ].map((table) => db.select({ n: count() }).from(table).get()?.n);

  it('removes every log, check, medication and its history', () => {
    const { db } = createTestDb();
    seed(db);
    expect(rows(db).every((n) => (n ?? 0) > 0)).toBe(true);

    deleteAllData(db);

    expect(rows(db)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('resets every setting, including onboarding, so the welcome shows again', () => {
    const { db } = createTestDb();
    seed(db);

    deleteAllData(db);

    expect(getAllSettings(db)).toEqual(DEFAULT_SETTINGS);
    expect(db.select({ n: count() }).from(appSettings).get()?.n).toBe(0);
  });

  it('is safe on an empty database and lets new data be logged afterwards', () => {
    const { db } = createTestDb();
    expect(() => deleteAllData(db)).not.toThrow();

    createSymptomLog(db, { items: [{ key: 'heartburn' }], loggedAt: DAY.from, tz: 'UTC' });
    expect(listSymptomLogs(db, DAY)).toHaveLength(1);
  });
});

describe('countLoggedEntries', () => {
  it('counts diary meals, symptom logs and doses, but not one-off checks', () => {
    const { db } = createTestDb();
    expect(countLoggedEntries(db)).toBe(0);

    createSymptomLog(db, { items: [{ key: 'heartburn' }], loggedAt: DAY.from, tz: 'UTC' });
    createFoodLog(db, { entryType: 'diary', source: 'text', inputText: 'mint tea', analysis: mintTea, meta });
    createUncheckedMeal(db, { source: 'text', inputText: 'toast' });
    const checkId = createFoodLog(db, {
      entryType: 'check',
      source: 'text',
      inputText: 'tea',
      analysis: mintTea,
      meta,
    });
    const medId = createMedication(db, { name: 'Omeprazole', type: 'ppi' });
    logMedication(db, medId, { takenAt: DAY.from, tz: 'UTC' });
    expect(countLoggedEntries(db)).toBe(4);

    promoteCheckToDiary(db, checkId);
    expect(countLoggedEntries(db)).toBe(5);
  });
});

describe('deleting an entry and undoing it', () => {
  const symptomRow = (db: ReturnType<typeof createTestDb>['db'], id: number) =>
    db.select().from(symptomLogs).where(eq(symptomLogs.id, id)).get();

  it('puts a meal back with its tags, and links the symptom that followed it again', () => {
    const { db } = createTestDb();
    const mealId = createFoodLog(db, {
      entryType: 'diary',
      source: 'text',
      inputText: 'mint tea',
      analysis: mintTea,
      meta,
    });
    saveMealDetails(db, mealId, { tags: ['stress'], notes: 'heavy', loggedAt: '2026-09-28T19:00:00.000Z' });
    const symptomId = createSymptomLog(db, {
      items: [{ key: 'heartburn' }],
      foodLogId: mealId,
      loggedAt: DAY.from,
      tz: 'UTC',
    });
    const before = db.select().from(foodLogs).where(eq(foodLogs.id, mealId)).get();

    const deleted = deleteEntry(db, { kind: 'food', id: mealId });

    expect(deleted?.kind).toBe('food');
    expect(db.select({ n: count() }).from(foodLogs).get()?.n).toBe(0);
    expect(db.select({ n: count() }).from(foodLogTags).get()?.n).toBe(0);
    expect(symptomRow(db, symptomId)?.foodLogId).toBeNull();

    restoreEntry(db, deleted!);

    expect(db.select().from(foodLogs).where(eq(foodLogs.id, mealId)).get()).toEqual(before);
    expect(
      db
        .select()
        .from(foodLogTags)
        .all()
        .map((row) => row.tagKey),
    ).toEqual(['stress']);
    expect(symptomRow(db, symptomId)?.foodLogId).toBe(mealId);
  });

  it('puts a symptom log back with its symptoms and tags', () => {
    const { db } = createTestDb();
    const id = createSymptomLog(db, {
      items: [{ key: 'heartburn' }, { key: 'burping' }],
      tags: ['large_meal'],
      notes: 'after dinner',
      loggedAt: '2026-09-28T20:20:00.000Z',
      tz: 'Europe/London',
    });
    const before = listSymptomLogs(db, DAY);

    const deleted = deleteEntry(db, { kind: 'symptom', id });
    expect(listSymptomLogs(db, DAY)).toHaveLength(0);
    restoreEntry(db, deleted!);

    expect(listSymptomLogs(db, DAY)).toEqual(before);
  });

  it('puts a dose back', () => {
    const { db } = createTestDb();
    const medId = createMedication(db, { name: 'Omeprazole', type: 'ppi' });
    logMedication(db, medId, { takenAt: '2026-09-28T07:00:00.000Z', tz: 'Europe/London' });
    const before = db.select().from(medicationLogs).all();

    const deleted = deleteEntry(db, { kind: 'medication', id: before[0]!.id });
    expect(db.select({ n: count() }).from(medicationLogs).get()?.n).toBe(0);
    restoreEntry(db, deleted!);

    expect(db.select().from(medicationLogs).all()).toEqual(before);
  });

  it('says so when there is nothing to delete', () => {
    const { db } = createTestDb();
    expect(deleteEntry(db, { kind: 'food', id: 99 })).toBeUndefined();
    expect(deleteEntry(db, { kind: 'symptom', id: 99 })).toBeUndefined();
    expect(deleteEntry(db, { kind: 'medication', id: 99 })).toBeUndefined();
  });
});

describe('setMealTime', () => {
  it('moves the meal and leaves its note and tags alone', () => {
    const { db } = createTestDb();
    const id = createFoodLog(db, {
      entryType: 'diary',
      source: 'text',
      inputText: 'mint tea',
      analysis: mintTea,
      meta,
    });
    saveMealDetails(db, id, { tags: ['stress'], notes: 'heavy' });

    setMealTime(db, id, '2026-09-28T18:30:00.000Z');

    const row = db.select().from(foodLogs).where(eq(foodLogs.id, id)).get();
    expect(row?.loggedAt).toBe('2026-09-28T18:30:00.000Z');
    expect(row?.notes).toBe('heavy');
    expect(
      db
        .select()
        .from(foodLogTags)
        .all()
        .map((tag) => tag.tagKey),
    ).toEqual(['stress']);
  });

  it('refuses a meal that is not there', () => {
    const { db } = createTestDb();
    expect(() => setMealTime(db, 99, '2026-09-28T18:30:00.000Z')).toThrow('not found');
  });
});

describe('meals waiting for a verdict ("Just log it")', () => {
  const NOW = new Date('2026-09-29T12:00:00.000Z');
  const ago = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();
  /** `createdAt` is set by the database, so age a meal by editing it. */
  const aged = (db: ReturnType<typeof createTestDb>['db'], id: number, hours: number) =>
    db
      .update(foodLogs)
      .set({ createdAt: ago(hours) })
      .where(eq(foodLogs.id, id))
      .run();

  it('lists diary meals saved without a verdict, newest first, and nothing older than 48 hours', () => {
    const { db } = createTestDb();
    const old = createUncheckedMeal(db, { source: 'text', inputText: 'old toast' });
    const first = createUncheckedMeal(db, { source: 'text', inputText: 'rice' });
    const second = createUncheckedMeal(db, { source: 'photo' });
    createFoodLog(db, { entryType: 'diary', source: 'text', analysis: mintTea, meta });
    aged(db, old, 49);
    aged(db, first, 3);
    aged(db, second, 1);

    expect(listPendingChecks(db, NOW).map((meal) => meal.id)).toEqual([second, first]);
    expect(isPendingCheck(getFoodLog(db, first)!, NOW)).toBe(true);
    expect(isPendingCheck(getFoodLog(db, old)!, NOW)).toBe(false);
  });

  it('is not waiting once it has a verdict, and a check is never waiting', () => {
    const { db } = createTestDb();
    const id = createUncheckedMeal(db, { source: 'text', inputText: 'mint tea' });
    aged(db, id, 1);
    expect(setMealAnalysis(db, id, { analysis: mintTea, meta })).toBe(true);

    expect(isPendingCheck(getFoodLog(db, id)!, NOW)).toBe(false);
    expect(listPendingChecks(db, NOW)).toEqual([]);
  });

  it('attaches the verdict and keeps the name that was typed', () => {
    const { db } = createTestDb();
    const id = createUncheckedMeal(db, { source: 'text', inputText: 'my tea' });

    expect(setMealAnalysis(db, id, { analysis: mintTea, meta })).toBe(true);

    expect(getFoodLog(db, id)).toMatchObject({
      mealName: 'my tea',
      overallVerdict: 'caution',
      analysis: mintTea,
      analysisMeta: meta,
    });
  });

  it('names a photo meal from its verdict', () => {
    const { db } = createTestDb();
    const id = createUncheckedMeal(db, { source: 'photo', photoUri: 'file:///photos/a.jpg' });

    setMealAnalysis(db, id, { analysis: mintTea, meta });

    expect(getFoodLog(db, id)?.mealName).toBe('Mint tea');
  });

  it('leaves a meal that already has a verdict alone, and refuses what is not food', () => {
    const { db } = createTestDb();
    const id = createFoodLog(db, { entryType: 'diary', source: 'text', analysis: mintTea, meta });
    expect(setMealAnalysis(db, id, { analysis: { ...mintTea, mealName: 'Other' }, meta })).toBe(false);
    expect(getFoodLog(db, id)?.mealName).toBe('Mint tea');

    const waiting = createUncheckedMeal(db, { source: 'text', inputText: 'rock' });
    expect(() => setMealAnalysis(db, waiting, { analysis: { ...mintTea, isFood: false }, meta })).toThrow();
    expect(getFoodLog(db, waiting)?.analysis).toBeNull();
  });
});
