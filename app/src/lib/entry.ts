import type { StoredFoodLog } from '@/db/repositories/food';
import { getFoodLog } from '@/db/repositories/food';
import { getMedicationLog } from '@/db/repositories/medications';
import { getSymptomLog, type SymptomLogWithDetails } from '@/db/repositories/symptoms';
import type { MedicationLog } from '@/db/schema';
import type { AppDb } from '@/db/types';

import type { TimelineKind } from './timeline';

/** One diary entry opened from History, with everything its screen needs. */
export type LoadedEntry =
  | { kind: 'food'; log: StoredFoodLog }
  | { kind: 'symptom'; log: SymptomLogWithDetails }
  | { kind: 'medication'; log: MedicationLog };

export const isEntryKind = (value: unknown): value is TimelineKind =>
  value === 'food' || value === 'symptom' || value === 'medication';

/** The entry with this kind and id, or undefined when it was deleted or the link is malformed. */
export function loadEntry(db: AppDb, kind: unknown, rawId: unknown): LoadedEntry | undefined {
  const id = Number(rawId);
  if (!isEntryKind(kind) || !Number.isInteger(id)) return undefined;
  if (kind === 'food') {
    const log = getFoodLog(db, id);
    // A food check, not a diary meal, has no place in History.
    return log && log.entryType === 'diary' ? { kind, log } : undefined;
  }
  if (kind === 'symptom') {
    const log = getSymptomLog(db, id);
    return log ? { kind, log } : undefined;
  }
  const log = getMedicationLog(db, id);
  return log ? { kind, log } : undefined;
}
