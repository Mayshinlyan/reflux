import { asc, desc, eq, sql } from 'drizzle-orm';

import type { SymptomArea } from '@/constants/bodyZones';
import { cleanCustomSymptom } from '@/constants/symptomItems';

import { type SavedSymptom, savedSymptoms } from '../schema';
import type { AppDb } from '../types';

export type SavedKind = SavedSymptom['kind'];

/** "My additions": what the user typed with a "+" chip, symptoms first, each A to Z. */
export function listSavedSymptoms(db: AppDb, kind?: SavedKind): SavedSymptom[] {
  return (
    db
      .select()
      .from(savedSymptoms)
      .where(kind ? eq(savedSymptoms.kind, kind) : undefined)
      // 'symptom' sorts after 'lifestyle', so descending puts symptoms first.
      .orderBy(desc(savedSymptoms.kind), asc(sql`lower(${savedSymptoms.name})`), asc(savedSymptoms.id))
      .all()
  );
}

/**
 * Adds something the user typed: a symptom (in the body area it was added in) or a lifestyle factor. A name
 * already on the list (any capitals) changes nothing and returns the existing row, so a second tap can't
 * add a duplicate. The name is unique across both kinds (the index ignores `kind`), so a lifestyle factor
 * named like a saved symptom returns that symptom's row and is not saved as a chip of its own.
 */
export function createSavedSymptom(
  db: AppDb,
  name: string,
  kind: SavedKind = 'symptom',
  zone?: SymptomArea,
): SavedSymptom {
  const clean = cleanCustomSymptom(name);
  if (!clean) throw new Error('A saved symptom needs a name');
  const existing = db
    .select()
    .from(savedSymptoms)
    .where(sql`lower(${savedSymptoms.name}) = lower(${clean})`)
    .get();
  if (existing) return existing;
  return db
    .insert(savedSymptoms)
    .values({ name: clean, kind, zone: kind === 'symptom' ? (zone ?? null) : null })
    .returning()
    .get();
}

/** Takes one off "My additions". Entries already logged with it keep it. */
export function removeSavedSymptom(db: AppDb, id: number): void {
  db.delete(savedSymptoms).where(eq(savedSymptoms.id, id)).run();
}
