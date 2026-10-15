import { deleteAllData } from '../repositories/data';
import { createUncheckedMeal } from '../repositories/food';
import {
  createSavedFood,
  onSavedFoodsChange,
  removeSavedFood,
  renameSavedFood,
  saveFoodFromLog,
  updateSavedFood,
} from '../repositories/savedFoods';
import type { AppDb } from '../types';
import { createTestDb } from './testDb';

let db: AppDb;
let close: () => void;
const listener = jest.fn();

beforeEach(() => {
  const test = createTestDb();
  db = test.db;
  close = () => test.sqlite.close();
  listener.mockClear();
  onSavedFoodsChange(listener);
});
afterEach(() => {
  onSavedFoodsChange(null);
  close();
});

describe('telling the widget that My foods changed', () => {
  it('fires once for each way the list changes', () => {
    const id = createSavedFood(db, 'Oatmeal');
    expect(listener).toHaveBeenCalledTimes(1);

    renameSavedFood(db, id, 'Porridge');
    expect(listener).toHaveBeenCalledTimes(2);

    updateSavedFood(db, id, { name: 'Porridge with berries' });
    expect(listener).toHaveBeenCalledTimes(3);

    removeSavedFood(db, id);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('fires when a logged meal is saved to My foods, but not when it was already saved', () => {
    const mealId = createUncheckedMeal(db, { source: 'text', inputText: 'Toast' });
    expect(saveFoodFromLog(db, mealId).created).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    expect(saveFoodFromLog(db, mealId).created).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('fires when all data is deleted, since the widget lists foods and holds a token', () => {
    createSavedFood(db, 'Oatmeal');
    listener.mockClear();
    deleteAllData(db);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not fire for a change that failed', () => {
    expect(() => renameSavedFood(db, 999, 'Nothing')).toThrow('not found');
    expect(() => createSavedFood(db, '   ')).toThrow('needs a name');
    expect(listener).not.toHaveBeenCalled();
  });

  it('never lets a failing listener break the save', () => {
    listener.mockImplementation(() => {
      throw new Error('widget is unavailable');
    });
    const id = createSavedFood(db, 'Oatmeal');
    expect(id).toBeGreaterThan(0);
    expect(() => removeSavedFood(db, id)).not.toThrow();
  });
});
