import { createTestDb } from '@/db/__tests__/testDb';
import { createUncheckedMeal, getFoodLog } from '@/db/repositories/food';
import { setSetting } from '@/db/repositories/settings';
import type { AppDb } from '@/db/types';
import { onEntriesChanged } from '@/lib/entriesChanged';
import { AppError } from '@/lib/errors';

import { checkPendingMeals, isChecking, resetPendingChecks } from '../pendingChecks';
import { analyzeFood } from '../relayClient';

jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('../relayClient', () => ({ analyzeFood: jest.fn() }));

const analyze = analyzeFood as jest.Mock;

const verdict = {
  isFood: true,
  mealName: 'Mint tea',
  items: [
    {
      name: 'Mint tea',
      ingredients: [{ name: 'Peppermint', matchedCategories: ['mint'] }],
      verdict: 'caution',
      reasoning: 'Peppermint relaxes the valve.',
      matchedTriggers: [{ category: 'mint', evidence: 'peppermint' }],
    },
  ],
  overall: { verdict: 'caution', confidence: 'high', reasoning: 'Mint is a common trigger.' },
  meta: { model: 'm', promptVersion: 'p', rulesetVersion: 'r' },
};

let db: AppDb;
let closeDb: () => void;
let changed: jest.Mock;
let unsubscribe: () => void;

beforeEach(() => {
  const test = createTestDb();
  db = test.db;
  closeDb = () => test.sqlite.close();
  analyze.mockReset();
  resetPendingChecks();
  changed = jest.fn();
  unsubscribe = onEntriesChanged(changed);
});

afterEach(() => {
  unsubscribe();
  closeDb();
});

describe('checkPendingMeals', () => {
  it('checks a meal logged with "Just log it", keeps its name, and tells Today and History to reload', async () => {
    const id = createUncheckedMeal(db, { source: 'text', inputText: 'mint tea' });
    analyze.mockResolvedValue(verdict);

    await checkPendingMeals(db);

    expect(analyze).toHaveBeenCalledWith({ text: 'mint tea' });
    expect(getFoodLog(db, id)).toMatchObject({ mealName: 'mint tea', overallVerdict: 'caution' });
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('sends the stored photo for a photo meal and the conditions from settings', async () => {
    setSetting(db, 'conditions', ['acid_reflux']);
    const id = createUncheckedMeal(db, { source: 'photo', photoUri: 'file:///photos/a.jpg' });
    analyze.mockResolvedValue(verdict);

    await checkPendingMeals(db);

    expect(analyze).toHaveBeenCalledWith({
      photo: { uri: 'file:///photos/a.jpg', mimeType: 'image/jpeg' },
      conditions: ['acid_reflux'],
    });
    expect(getFoodLog(db, id)?.mealName).toBe('Mint tea');
  });

  it('tries again later when there is no signal, and stops asking for the rest', async () => {
    const first = createUncheckedMeal(db, { source: 'text', inputText: 'rice' });
    createUncheckedMeal(db, { source: 'text', inputText: 'soup' });
    analyze.mockRejectedValue(new AppError('OFFLINE'));

    await checkPendingMeals(db);
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(getFoodLog(db, first)?.analysis).toBeNull();
    expect(changed).not.toHaveBeenCalled();

    analyze.mockResolvedValue(verdict);
    await checkPendingMeals(db);
    expect(analyze).toHaveBeenCalledTimes(3); // the one that failed, then both meals
    expect(getFoodLog(db, first)?.analysis).not.toBeNull();
  });

  it('does not ask again about something the relay said is not food', async () => {
    createUncheckedMeal(db, { source: 'text', inputText: 'a rock' });
    analyze.mockRejectedValue(new AppError('NOT_FOOD'));

    await checkPendingMeals(db);
    await checkPendingMeals(db);

    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it('skips a meal with nothing to check, and never throws', async () => {
    createUncheckedMeal(db, { source: 'photo' }); // no text and no photo file
    createUncheckedMeal(db, { source: 'text', inputText: 'rice' });
    analyze.mockRejectedValue(new Error('boom'));

    await expect(checkPendingMeals(db)).resolves.toBeUndefined();
    expect(analyze).toHaveBeenCalledTimes(1);
  });
  it('also checks a meal logged while a run is already in flight', async () => {
    const first = createUncheckedMeal(db, { source: 'text', inputText: 'rice' });
    let release!: (value: unknown) => void;
    analyze.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    analyze.mockResolvedValue(verdict);

    const run = checkPendingMeals(db); // the app just came to the front
    const second = createUncheckedMeal(db, { source: 'text', inputText: 'soup' });
    await checkPendingMeals(db); // "Just log it" while that run waits on the relay
    release(verdict);
    await run;

    expect(getFoodLog(db, first)?.analysis).not.toBeNull();
    expect(getFoodLog(db, second)?.analysis).not.toBeNull();
  });

  it('stops saying "Checking…" for a meal it has given up on, and tells the rows', async () => {
    const id = createUncheckedMeal(db, { source: 'text', inputText: 'a rock' });
    expect(isChecking(getFoodLog(db, id)!)).toBe(true);
    analyze.mockResolvedValue({ ...verdict, isFood: false });

    await checkPendingMeals(db);

    expect(isChecking(getFoodLog(db, id)!)).toBe(false);
    expect(getFoodLog(db, id)?.analysis).toBeNull();
    expect(changed).toHaveBeenCalled();
  });
});
