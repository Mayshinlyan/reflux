import { deleteAllData } from '../repositories/data';
import { createSavedSymptom, listSavedSymptoms, removeSavedSymptom } from '../repositories/savedSymptoms';
import { createSymptomLog, getSymptomLog, setMealSymptoms } from '../repositories/symptoms';
import { createUncheckedMeal } from '../repositories/food';
import type { AppDb } from '../types';
import { createTestDb } from './testDb';

let db: AppDb;
let close: () => void;

beforeEach(() => {
  const test = createTestDb();
  db = test.db;
  close = () => test.sqlite.close();
});
afterEach(() => close());

describe('saved symptoms (My symptoms)', () => {
  it('adds a tidied name and lists them A to Z', () => {
    createSavedSymptom(db, '  Jaw   tightness ');
    createSavedSymptom(db, 'hiccups');
    createSavedSymptom(db, 'Dry mouth');

    expect(listSavedSymptoms(db).map((row) => row.name)).toEqual(['Dry mouth', 'hiccups', 'Jaw tightness']);
  });

  it('keeps one row per name, ignoring capitals, and returns the one already saved', () => {
    const first = createSavedSymptom(db, 'Hiccups');
    const again = createSavedSymptom(db, 'hiccups');

    expect(again).toEqual(first);
    expect(listSavedSymptoms(db)).toHaveLength(1);
  });

  it('refuses a blank name and cuts a long one to 40 characters', () => {
    expect(() => createSavedSymptom(db, '   ')).toThrow('needs a name');
    expect(createSavedSymptom(db, 'x'.repeat(60)).name).toHaveLength(40);
  });

  it('removes one without touching entries already logged with it', () => {
    const { id } = createSavedSymptom(db, 'Hiccups');
    const logId = createSymptomLog(db, { items: [{ key: 'custom:Hiccups' }] });

    removeSavedSymptom(db, id);

    expect(listSavedSymptoms(db)).toEqual([]);
    expect(getSymptomLog(db, logId)?.items).toEqual([{ key: 'custom:Hiccups', score: 1 }]);
  });

  it('is cleared by "Delete all my data"', () => {
    createSavedSymptom(db, 'Hiccups');
    deleteAllData(db);
    expect(listSavedSymptoms(db)).toEqual([]);
  });
});

describe('logging a symptom of your own', () => {
  it('stores a custom symptom beside built-in ones and reads it back, built-ins first', () => {
    const id = createSymptomLog(db, {
      items: [{ key: 'custom:Hiccups' }, { key: 'heartburn' }, { key: 'custom:Dry mouth' }],
    });

    expect(getSymptomLog(db, id)?.items.map((item) => item.key)).toEqual([
      'heartburn',
      'custom:Dry mouth',
      'custom:Hiccups',
    ]);
  });

  it('refuses an empty, untidy or duplicate custom symptom without repeating the text', () => {
    for (const key of [
      'custom:',
      'custom: padded',
      'custom:two  spaces',
      `custom:${'x'.repeat(41)}`,
    ] as const) {
      expect(() => createSymptomLog(db, { items: [{ key }] })).toThrow('Invalid custom symptom');
    }
    const duplicate = () =>
      createSymptomLog(db, { items: [{ key: 'custom:Secret' }, { key: 'custom:Secret' }] });
    expect(duplicate).toThrow('Duplicate symptom');
    expect(duplicate).not.toThrow(/Secret/);
  });

  it('leaves a custom symptom on a meal alone when the meal screen changes its own symptoms', () => {
    const mealId = createUncheckedMeal(db, { source: 'text', inputText: 'Toast' });
    const logId = createSymptomLog(db, {
      items: [{ key: 'heartburn' }, { key: 'custom:Hiccups' }],
      foodLogId: mealId,
    });

    setMealSymptoms(
      db,
      mealId,
      [],
      ['heartburn', 'burping', 'hoarseness', 'stomach_pain'],
      new Date().toISOString(),
    );

    expect(getSymptomLog(db, logId)?.items.map((item) => item.key)).toEqual(['custom:Hiccups']);
  });
});
