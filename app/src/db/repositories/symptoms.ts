import { and, asc, eq, gte, inArray, lt } from 'drizzle-orm';

import { LIFESTYLE_TAG_KEYS, type LifestyleTagKey } from '@/constants/lifestyleTags';
import { MAX_SCORE, SYMPTOM_KEYS, type SymptomKey } from '@/constants/symptomItems';
import { currentTimeZone, nowIso } from '@/lib/time';

import { type SymptomLog, symptomLogItems, symptomLogs, symptomLogTags } from '../schema';
import type { AppDb } from '../types';

export type SymptomItemInput = { key: SymptomKey; score: number };

export type SymptomLogInput = {
  items: SymptomItemInput[];
  tags?: LifestyleTagKey[];
  notes?: string | null;
  /** Defaults to now. */
  loggedAt?: string;
  tz?: string;
};

export type SymptomLogWithDetails = SymptomLog & {
  items: SymptomItemInput[];
  tags: LifestyleTagKey[];
};

/** Quick logs score 1–5 (a symptom you tapped is at least 1). */
const MIN_QUICK_SCORE = 1;
const MAX_NOTES_LENGTH = 1000;

function validate(input: SymptomLogInput): void {
  if (input.items.length === 0) throw new Error('A symptom log needs at least one symptom');
  const seen = new Set<string>();
  for (const item of input.items) {
    if (!SYMPTOM_KEYS.includes(item.key)) throw new Error(`Unknown symptom: ${item.key}`);
    if (seen.has(item.key)) throw new Error(`Duplicate symptom: ${item.key}`);
    seen.add(item.key);
    if (!Number.isInteger(item.score) || item.score < MIN_QUICK_SCORE || item.score > MAX_SCORE) {
      throw new Error(`Score must be ${MIN_QUICK_SCORE}–${MAX_SCORE}`);
    }
  }
  for (const tag of input.tags ?? []) {
    if (!LIFESTYLE_TAG_KEYS.includes(tag)) throw new Error(`Unknown tag: ${tag}`);
  }
  if ((input.notes?.length ?? 0) > MAX_NOTES_LENGTH) throw new Error('Notes are too long');
}

function writeChildren(tx: AppDb, logId: number, input: SymptomLogInput): void {
  tx.insert(symptomLogItems)
    .values(input.items.map((item) => ({ symptomLogId: logId, itemKey: item.key, score: item.score })))
    .run();
  const tags = [...new Set(input.tags ?? [])];
  if (tags.length > 0) {
    tx.insert(symptomLogTags)
      .values(tags.map((tagKey) => ({ symptomLogId: logId, tagKey })))
      .run();
  }
}

export function createSymptomLog(db: AppDb, input: SymptomLogInput): number {
  validate(input);
  return db.transaction((tx) => {
    const row = tx
      .insert(symptomLogs)
      .values({
        kind: 'quick',
        loggedAt: input.loggedAt ?? nowIso(),
        tz: input.tz ?? currentTimeZone(),
        notes: input.notes?.trim() || null,
      })
      .returning({ id: symptomLogs.id })
      .get();
    writeChildren(tx as unknown as AppDb, row.id, input);
    return row.id;
  });
}

/** Replaces the symptoms, tags and notes of an existing log. */
export function updateSymptomLog(db: AppDb, id: number, input: SymptomLogInput): void {
  validate(input);
  db.transaction((tx) => {
    const updated = tx
      .update(symptomLogs)
      .set({
        notes: input.notes?.trim() || null,
        updatedAt: nowIso(),
        ...(input.loggedAt ? { loggedAt: input.loggedAt, tz: input.tz ?? currentTimeZone() } : {}),
      })
      .where(eq(symptomLogs.id, id))
      .returning({ id: symptomLogs.id })
      .all();
    if (updated.length === 0) throw new Error(`Symptom log ${id} not found`);
    tx.delete(symptomLogItems).where(eq(symptomLogItems.symptomLogId, id)).run();
    tx.delete(symptomLogTags).where(eq(symptomLogTags.symptomLogId, id)).run();
    writeChildren(tx as unknown as AppDb, id, input);
  });
}

export function deleteSymptomLog(db: AppDb, id: number): void {
  // Items and tags go with it (ON DELETE CASCADE).
  db.delete(symptomLogs).where(eq(symptomLogs.id, id)).run();
}

function withDetails(db: AppDb, logs: SymptomLog[]): SymptomLogWithDetails[] {
  if (logs.length === 0) return [];
  const ids = logs.map((log) => log.id);
  const items = db.select().from(symptomLogItems).where(inArray(symptomLogItems.symptomLogId, ids)).all();
  const tags = db.select().from(symptomLogTags).where(inArray(symptomLogTags.symptomLogId, ids)).all();
  // SQLite returns rows in index order (alphabetical keys); present them in the app's own order.
  return logs.map((log) => ({
    ...log,
    items: items
      .filter((item) => item.symptomLogId === log.id)
      .map((item) => ({ key: item.itemKey as SymptomKey, score: item.score }))
      .sort((a, b) => orderOf(SYMPTOM_KEYS, a.key) - orderOf(SYMPTOM_KEYS, b.key)),
    tags: tags
      .filter((tag) => tag.symptomLogId === log.id)
      .map((tag) => tag.tagKey as LifestyleTagKey)
      .sort((a, b) => orderOf(LIFESTYLE_TAG_KEYS, a) - orderOf(LIFESTYLE_TAG_KEYS, b)),
  }));
}

/** Position in the canonical list; unknown keys (from a newer app version) go last. */
function orderOf(keys: readonly string[], key: string): number {
  const index = keys.indexOf(key);
  return index === -1 ? keys.length : index;
}

export function getSymptomLog(db: AppDb, id: number): SymptomLogWithDetails | undefined {
  const log = db.select().from(symptomLogs).where(eq(symptomLogs.id, id)).get();
  return log ? withDetails(db, [log])[0] : undefined;
}

/** Logs with `from <= logged_at < to` (ISO UTC strings), oldest first. */
export function listSymptomLogs(db: AppDb, range: { from: string; to: string }): SymptomLogWithDetails[] {
  const logs = db
    .select()
    .from(symptomLogs)
    .where(and(gte(symptomLogs.loggedAt, range.from), lt(symptomLogs.loggedAt, range.to)))
    .orderBy(asc(symptomLogs.loggedAt), asc(symptomLogs.id))
    .all();
  return withDetails(db, logs);
}
