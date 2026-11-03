import { deleteAllData } from '../repositories/data';
import {
  fridgeUpdatedAt,
  listFridgeItems,
  MAX_FRIDGE_ITEMS,
  removeFridgeItem,
  replaceFridge,
} from '../repositories/fridgeItems';
import { DEFAULT_SETTINGS, getSetting, setSetting } from '../repositories/settings';
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

describe('My fridge', () => {
  it('starts empty, with no update time', () => {
    expect(listFridgeItems(db)).toEqual([]);
    expect(fridgeUpdatedAt(db)).toBeNull();
  });

  it('keeps tidied names, A to Z, one per name ignoring capitals', () => {
    const count = replaceFridge(db, ['  Spinach ', 'eggs', 'Eggs', 'Kimchi', '   ', 'rice<>']);

    expect(count).toBe(4);
    expect(listFridgeItems(db).map((item) => item.name)).toEqual(['eggs', 'Kimchi', 'rice', 'Spinach']);
  });

  it('replaces the whole list on a new scan', () => {
    replaceFridge(db, ['eggs', 'rice']);
    replaceFridge(db, ['tofu']);

    expect(listFridgeItems(db).map((item) => item.name)).toEqual(['tofu']);
  });

  it('keeps at most 40 names and cuts a long one to 40 characters', () => {
    const many = Array.from({ length: 60 }, (_, index) => `food ${index}`);
    expect(replaceFridge(db, many)).toBe(MAX_FRIDGE_ITEMS);
    expect(listFridgeItems(db)).toHaveLength(MAX_FRIDGE_ITEMS);

    replaceFridge(db, ['a'.repeat(80)]);
    expect(listFridgeItems(db)[0]?.name).toHaveLength(40);
  });

  it('removes one item', () => {
    replaceFridge(db, ['eggs', 'rice']);
    const [eggs] = listFridgeItems(db);
    removeFridgeItem(db, eggs!.id);

    expect(listFridgeItems(db).map((item) => item.name)).toEqual(['rice']);
  });

  it('says when it was last scanned, and removing an item does not change that', () => {
    replaceFridge(db, ['eggs', 'rice']);
    const stamp = fridgeUpdatedAt(db);
    expect(stamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    removeFridgeItem(db, listFridgeItems(db)[0]!.id);
    expect(fridgeUpdatedAt(db)).toBe(stamp);
  });

  it('is cleared by Delete all my data', () => {
    replaceFridge(db, ['eggs']);
    deleteAllData(db);

    expect(listFridgeItems(db)).toEqual([]);
  });
});

describe('the "Use my fridge" setting', () => {
  it('is on by default and only takes true or false', () => {
    expect(DEFAULT_SETTINGS.kitchenUseFridge).toBe(true);
    setSetting(db, 'kitchenUseFridge', false);
    expect(getSetting(db, 'kitchenUseFridge')).toBe(false);
    expect(() => setSetting(db, 'kitchenUseFridge', 'yes' as unknown as boolean)).toThrow();
  });
});
