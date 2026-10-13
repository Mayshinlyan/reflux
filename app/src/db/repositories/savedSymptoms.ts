import { asc, eq, sql } from 'drizzle-orm';

import { cleanCustomSymptom } from '@/constants/symptomItems';

import { type SavedSymptom, savedSymptoms } from '../schema';
import type { AppDb } from '../types';

/** "My symptoms", A to Z. */
export function listSavedSymptoms(db: AppDb): SavedSymptom[] {
  return db
    .select()
    .from(savedSymptoms)
    .orderBy(asc(sql`lower(${savedSymptoms.name})`), asc(savedSymptoms.id))
    .all();
}

/**
 * Adds a symptom the user typed. A name already on the list (any capitals) changes nothing and returns the
 * existing row, so a second tap can't add a duplicate.
 */
export function createSavedSymptom(db: AppDb, name: string): { id: number; name: string } {
  const clean = cleanCustomSymptom(name);
  if (!clean) throw new Error('A saved symptom needs a name');
  const existing = db
    .select()
    .from(savedSymptoms)
    .where(sql`lower(${savedSymptoms.name}) = lower(${clean})`)
    .get();
  if (existing) return { id: existing.id, name: existing.name };
  const id = db.insert(savedSymptoms).values({ name: clean }).returning({ id: savedSymptoms.id }).get().id;
  return { id, name: clean };
}

/** Takes a symptom off "My symptoms". Entries already logged with it keep it. */
export function removeSavedSymptom(db: AppDb, id: number): void {
  db.delete(savedSymptoms).where(eq(savedSymptoms.id, id)).run();
}
