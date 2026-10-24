import { eq } from 'drizzle-orm';

import {
  foodLogs,
  foodLogTags,
  medicationLogs,
  symptomLogItems,
  symptomLogs,
  symptomLogTags,
} from '../schema';
import type { AppDb } from '../types';

type Row<T extends { $inferSelect: unknown }> = T['$inferSelect'];

/** Everything a deleted entry took with it, so Undo can put it back exactly as it was (same ids, same times). */
export type DeletedEntry =
  | {
      kind: 'food';
      log: Row<typeof foodLogs>;
      tags: Row<typeof foodLogTags>[];
      /** Symptom logs that were linked to this meal; deleting the meal cleared their link. */
      linkedSymptomIds: number[];
    }
  | {
      kind: 'symptom';
      log: Row<typeof symptomLogs>;
      items: Row<typeof symptomLogItems>[];
      tags: Row<typeof symptomLogTags>[];
    }
  | { kind: 'medication'; log: Row<typeof medicationLogs> };

/** Deletes an entry and returns what it deleted, or undefined when there was no such entry. */
export function deleteEntry(
  db: AppDb,
  entry: { kind: DeletedEntry['kind']; id: number },
): DeletedEntry | undefined {
  return db.transaction((tx) => {
    if (entry.kind === 'food') {
      const log = tx.select().from(foodLogs).where(eq(foodLogs.id, entry.id)).get();
      if (!log) return undefined;
      const tags = tx.select().from(foodLogTags).where(eq(foodLogTags.foodLogId, entry.id)).all();
      const linkedSymptomIds = tx
        .select({ id: symptomLogs.id })
        .from(symptomLogs)
        .where(eq(symptomLogs.foodLogId, entry.id))
        .all()
        .map((row) => row.id);
      // Tags go with it (ON DELETE CASCADE) and linked symptom logs lose their link (ON DELETE SET NULL).
      tx.delete(foodLogs).where(eq(foodLogs.id, entry.id)).run();
      return { kind: 'food', log, tags, linkedSymptomIds };
    }
    if (entry.kind === 'symptom') {
      const log = tx.select().from(symptomLogs).where(eq(symptomLogs.id, entry.id)).get();
      if (!log) return undefined;
      const items = tx.select().from(symptomLogItems).where(eq(symptomLogItems.symptomLogId, entry.id)).all();
      const tags = tx.select().from(symptomLogTags).where(eq(symptomLogTags.symptomLogId, entry.id)).all();
      tx.delete(symptomLogs).where(eq(symptomLogs.id, entry.id)).run();
      return { kind: 'symptom', log, items, tags };
    }
    const log = tx.select().from(medicationLogs).where(eq(medicationLogs.id, entry.id)).get();
    if (!log) return undefined;
    tx.delete(medicationLogs).where(eq(medicationLogs.id, entry.id)).run();
    return { kind: 'medication', log };
  });
}

/** Puts back an entry that `deleteEntry` returned. A meal's photo file is never deleted with it, so it still shows. */
export function restoreEntry(db: AppDb, deleted: DeletedEntry): void {
  db.transaction((tx) => {
    if (deleted.kind === 'food') {
      tx.insert(foodLogs).values(deleted.log).run();
      if (deleted.tags.length > 0) tx.insert(foodLogTags).values(deleted.tags).run();
      for (const id of deleted.linkedSymptomIds) {
        tx.update(symptomLogs).set({ foodLogId: deleted.log.id }).where(eq(symptomLogs.id, id)).run();
      }
    } else if (deleted.kind === 'symptom') {
      tx.insert(symptomLogs).values(deleted.log).run();
      if (deleted.items.length > 0) tx.insert(symptomLogItems).values(deleted.items).run();
      if (deleted.tags.length > 0) tx.insert(symptomLogTags).values(deleted.tags).run();
    } else {
      tx.insert(medicationLogs).values(deleted.log).run();
    }
  });
}
