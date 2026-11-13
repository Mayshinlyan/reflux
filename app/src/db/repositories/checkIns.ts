import { eq } from 'drizzle-orm';

import { foodLogs, medicationLogs, symptomLogs } from '../schema';
import type { AppDb } from '../types';

/** When a log was made on this phone (not the time it is about), so a backdated meal still counts as today's check-in. */
export type CheckInStamp = { at: string; kind: 'meal' | 'symptoms' | 'dose' };

/** Every diary meal, symptom log and dose, by when it was logged. Meal checks are not check-ins. */
export function listCheckIns(db: AppDb): CheckInStamp[] {
  const meals = db
    .select({ at: foodLogs.createdAt })
    .from(foodLogs)
    .where(eq(foodLogs.entryType, 'diary'))
    .all()
    .map((row) => ({ at: row.at, kind: 'meal' as const }));
  const symptoms = db
    .select({ at: symptomLogs.createdAt })
    .from(symptomLogs)
    .all()
    .map((row) => ({ at: row.at, kind: 'symptoms' as const }));
  const doses = db
    .select({ at: medicationLogs.createdAt })
    .from(medicationLogs)
    .all()
    .map((row) => ({ at: row.at, kind: 'dose' as const }));
  return [...meals, ...symptoms, ...doses];
}
