import { and, eq, like, lt } from 'drizzle-orm';

import { isInsight } from '@/lib/insight';
import { nowIso } from '@/lib/time';
import type { Insight, InsightRange } from '@/types/insight';

import { appSettings } from '../schema';
import type { AppDb } from '../types';

const PREFIX = 'insight:';
/** Summaries of days and weeks long past are never shown again; drop them after this long. */
const KEEP_DAYS = 21;

/** One cached summary per day or week: `insight:day:2026-10-21`, `insight:week:2026-10-18`. */
export const insightKey = (range: InsightRange, periodKey: string) => `${PREFIX}${range}:${periodKey}`;

/**
 * Bellie's summaries are kept in the same table as the settings (under their own `insight:` keys), so
 * "Delete all my data" clears them along with everything else. A summary is only returned when it was made
 * from exactly what is logged now (`hash`); anything else means the entries changed and it is asked for again.
 */
export function getCachedInsight(db: AppDb, key: string, hash: string): Insight | null {
  const row = db.select().from(appSettings).where(eq(appSettings.key, key)).get();
  if (!row) return null;
  try {
    const stored = JSON.parse(row.value) as { hash?: unknown; insight?: unknown };
    return stored.hash === hash && isInsight(stored.insight) ? stored.insight : null;
  } catch {
    return null;
  }
}

export function saveInsight(db: AppDb, key: string, hash: string, insight: Insight): void {
  const value = JSON.stringify({ hash, insight });
  const updatedAt = nowIso();
  db.insert(appSettings)
    .values({ key, value, updatedAt })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt } })
    .run();
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString();
  db.delete(appSettings)
    .where(and(like(appSettings.key, `${PREFIX}%`), lt(appSettings.updatedAt, cutoff)))
    .run();
}
