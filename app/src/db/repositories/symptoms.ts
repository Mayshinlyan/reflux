import { and, asc, eq, gte, inArray, lt } from 'drizzle-orm';

import { isCustomTag, LIFESTYLE_TAG_KEYS, type LoggedTagKey } from '@/constants/lifestyleTags';
import {
  cleanCustomSymptom,
  customSymptomLabel,
  isCustomSymptom,
  type LoggedSymptomKey,
  QUICK_LOG_SCORE,
  SYMPTOM_KEYS,
} from '@/constants/symptomItems';
import { currentTimeZone, nowIso } from '@/lib/time';

import { type SymptomLog, symptomLogItems, symptomLogs, symptomLogTags } from '../schema';
import type { AppDb } from '../types';

/** The quick log records that a symptom was felt; it does not rate severity. */
export type SymptomItemInput = { key: LoggedSymptomKey };

/** As stored. Quick logs always have QUICK_LOG_SCORE; only the RSI check-in (M2) varies it. */
export type StoredSymptomItem = { key: LoggedSymptomKey; score: number };

export type SymptomLogInput = {
  /** May be empty when `tags` is not: a lifestyle-only check-in ("Just checking in"). */
  items: SymptomItemInput[];
  tags?: LoggedTagKey[];
  notes?: string | null;
  /** Defaults to now. */
  loggedAt?: string;
  tz?: string;
  /** The meal these symptoms followed. Set when creating; editing leaves the link as it was. */
  foodLogId?: number | null;
};

export type SymptomLogWithDetails = SymptomLog & {
  items: StoredSymptomItem[];
  tags: LoggedTagKey[];
};

const MAX_NOTES_LENGTH = 1000;

function validate(input: SymptomLogInput): void {
  if (input.items.length === 0 && (input.tags ?? []).length === 0) {
    throw new Error('A log needs a symptom or a lifestyle factor');
  }
  const seen = new Set<string>();
  for (const item of input.items) {
    // A custom symptom is the user's own text, so the messages never repeat it.
    if (isCustomSymptom(item.key)) {
      const text = customSymptomLabel(item.key);
      if (!text || cleanCustomSymptom(text) !== text) throw new Error('Invalid custom symptom');
    } else if (!SYMPTOM_KEYS.includes(item.key)) {
      throw new Error(`Unknown symptom: ${item.key}`);
    }
    if (seen.has(item.key)) throw new Error('Duplicate symptom');
    seen.add(item.key);
  }
  for (const tag of input.tags ?? []) {
    // Like a custom symptom, a custom tag is the user's own text, so the message never repeats it.
    if (isCustomTag(tag)) {
      const text = customSymptomLabel(tag);
      if (!text || cleanCustomSymptom(text) !== text) throw new Error('Invalid custom tag');
    } else if (!LIFESTYLE_TAG_KEYS.includes(tag)) {
      throw new Error(`Unknown tag: ${tag}`);
    }
  }
  if ((input.notes?.length ?? 0) > MAX_NOTES_LENGTH) throw new Error('Notes are too long');
}

function writeChildren(tx: AppDb, logId: number, input: SymptomLogInput): void {
  if (input.items.length > 0) {
    tx.insert(symptomLogItems)
      .values(input.items.map((item) => ({ symptomLogId: logId, itemKey: item.key, score: QUICK_LOG_SCORE })))
      .run();
  }
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
        foodLogId: input.foodLogId ?? null,
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

/**
 * Takes one symptom off an entry, keeping its other symptoms, tags and note. An entry must keep
 * a symptom or a lifestyle tag, so removing the last symptom is refused when there are no tags
 * (delete the entry instead); with tags it becomes a lifestyle-only entry.
 */
export function removeSymptomFromLog(db: AppDb, id: number, key: LoggedSymptomKey): void {
  db.transaction((tx) => {
    const items = tx
      .select({ itemKey: symptomLogItems.itemKey })
      .from(symptomLogItems)
      .where(eq(symptomLogItems.symptomLogId, id))
      .all();
    if (!items.some((item) => item.itemKey === key)) throw new Error('That symptom is not on this entry');
    if (items.length <= 1) {
      const tag = tx
        .select({ id: symptomLogTags.id })
        .from(symptomLogTags)
        .where(eq(symptomLogTags.symptomLogId, id))
        .get();
      if (!tag) throw new Error('An entry needs at least one symptom or lifestyle factor');
    }
    tx.delete(symptomLogItems)
      .where(and(eq(symptomLogItems.symptomLogId, id), eq(symptomLogItems.itemKey, key)))
      .run();
    tx.update(symptomLogs).set({ updatedAt: nowIso() }).where(eq(symptomLogs.id, id)).run();
  });
}

/** Takes one lifestyle tag off an entry. Unlike symptoms, tags are optional, so all of them can go. */
export function removeTagFromLog(db: AppDb, id: number, tag: LoggedTagKey): void {
  db.transaction((tx) => {
    const removed = tx
      .delete(symptomLogTags)
      .where(and(eq(symptomLogTags.symptomLogId, id), eq(symptomLogTags.tagKey, tag)))
      .returning({ id: symptomLogTags.id })
      .all();
    if (removed.length === 0) throw new Error('That tag is not on this entry');
    tx.update(symptomLogs).set({ updatedAt: nowIso() }).where(eq(symptomLogs.id, id)).run();
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
      .map((item) => ({ key: item.itemKey as LoggedSymptomKey, score: item.score }))
      .sort((a, b) => orderOf(SYMPTOM_KEYS, a.key) - orderOf(SYMPTOM_KEYS, b.key)),
    tags: tags
      .filter((tag) => tag.symptomLogId === log.id)
      .map((tag) => tag.tagKey as LoggedTagKey)
      .sort((a, b) => orderOf(LIFESTYLE_TAG_KEYS, a) - orderOf(LIFESTYLE_TAG_KEYS, b) || a.localeCompare(b)),
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

/** The symptom logs that were recorded as following a meal, oldest first. */
export function listSymptomLogsForMeal(db: AppDb, foodLogId: number): SymptomLogWithDetails[] {
  const logs = db
    .select()
    .from(symptomLogs)
    .where(eq(symptomLogs.foodLogId, foodLogId))
    .orderBy(asc(symptomLogs.loggedAt), asc(symptomLogs.id))
    .all();
  return withDetails(db, logs);
}

/**
 * Makes the `managed` symptoms on a meal's follow-up logs match `keys`: ones no longer wanted come off
 * (a log left with nothing is deleted), new ones go into one new log linked to the meal. Symptoms outside
 * `managed`, which the meal screen can't show, are left alone. A log left with no symptoms keeps
 * going as a lifestyle-only entry if it has tags.
 */
export function setMealSymptoms(
  db: AppDb,
  foodLogId: number,
  keys: readonly LoggedSymptomKey[],
  managed: readonly LoggedSymptomKey[],
  loggedAt: string,
): void {
  db.transaction((tx) => {
    const scope = tx as unknown as AppDb;
    const wanted = new Set(keys.filter((key) => managed.includes(key)));
    const present = new Set<LoggedSymptomKey>();
    for (const log of listSymptomLogsForMeal(scope, foodLogId)) {
      const drop = log.items
        .map((item) => item.key)
        .filter((key) => managed.includes(key) && !wanted.has(key));
      log.items.forEach((item) => managed.includes(item.key) && present.add(item.key));
      if (drop.length === 0) continue;
      if (drop.length === log.items.length && log.tags.length === 0) deleteSymptomLog(scope, log.id);
      else drop.forEach((key) => removeSymptomFromLog(scope, log.id, key));
      drop.forEach((key) => present.delete(key));
    }
    const added = [...wanted].filter((key) => !present.has(key));
    if (added.length > 0) {
      createSymptomLog(scope, { items: added.map((key) => ({ key })), foodLogId, loggedAt });
    }
  });
}
