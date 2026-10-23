import { eq } from 'drizzle-orm';

import { getCachedInsight, insightKey, saveInsight } from '@/db/repositories/insightCache';
import { deleteAllData } from '@/db/repositories/data';
import { appSettings } from '@/db/schema';
import type { AppDb } from '@/db/types';
import type { Insight } from '@/types/insight';

import { createTestDb } from './testDb';

let db: AppDb;
let closeDb: () => void;
beforeEach(() => {
  const created = createTestDb();
  db = created.db;
  closeDb = () => created.sqlite.close();
});
afterEach(() => closeDb());

const insight: Insight = {
  tone: 'nudge',
  bellieLine: 'Easy on the spice tonight?',
  summary: 'Spicy tacos late, then heartburn.',
  tips: ['Have spicy food earlier in the day.'],
};
const key = insightKey('day', '2026-10-10');

describe('insight cache', () => {
  it('names a day or a week by its range and first day', () => {
    expect(key).toBe('insight:day:2026-10-10');
    expect(insightKey('week', '2026-10-04')).toBe('insight:week:2026-10-04');
  });

  it('gives back a summary made from exactly the same logs, and nothing once they change', () => {
    expect(getCachedInsight(db, key, 'abc12345')).toBeNull();

    saveInsight(db, key, 'abc12345', insight);

    expect(getCachedInsight(db, key, 'abc12345')).toEqual(insight);
    expect(getCachedInsight(db, key, 'def67890')).toBeNull();
  });

  it('replaces the summary for the same day when it is saved again', () => {
    saveInsight(db, key, 'abc12345', insight);
    saveInsight(db, key, 'def67890', { ...insight, bellieLine: 'Nice one!' });

    expect(getCachedInsight(db, key, 'abc12345')).toBeNull();
    expect(getCachedInsight(db, key, 'def67890')?.bellieLine).toBe('Nice one!');
  });

  it('ignores a corrupt or malformed row instead of failing', () => {
    db.insert(appSettings).values({ key, value: 'not json', updatedAt: new Date().toISOString() }).run();
    expect(getCachedInsight(db, key, 'abc12345')).toBeNull();

    db.update(appSettings)
      .set({ value: JSON.stringify({ hash: 'abc12345', insight: { tone: 'angry' } }) })
      .where(eq(appSettings.key, key))
      .run();
    expect(getCachedInsight(db, key, 'abc12345')).toBeNull();
  });

  it('drops summaries of days long past when saving a new one, and keeps recent ones', () => {
    const old = insightKey('day', '2026-09-01');
    const recent = insightKey('day', '2026-10-09');
    saveInsight(db, old, 'aaaaaaaa', insight);
    saveInsight(db, recent, 'bbbbbbbb', insight);
    const longAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    db.update(appSettings).set({ updatedAt: longAgo }).where(eq(appSettings.key, old)).run();

    saveInsight(db, key, 'cccccccc', insight);

    expect(getCachedInsight(db, old, 'aaaaaaaa')).toBeNull();
    expect(getCachedInsight(db, recent, 'bbbbbbbb')).toEqual(insight);
    expect(getCachedInsight(db, key, 'cccccccc')).toEqual(insight);
  });

  it('is cleared by "Delete all my data", along with everything else', () => {
    saveInsight(db, key, 'abc12345', insight);

    deleteAllData(db);

    expect(getCachedInsight(db, key, 'abc12345')).toBeNull();
  });
});
