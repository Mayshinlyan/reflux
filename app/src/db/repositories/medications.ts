import { and, asc, eq, gte, lt, sql } from 'drizzle-orm';

import { MEDICATION_TYPE_KEYS, type MedicationType } from '@/constants/medicationTypes';
import { currentTimeZone, nowIso } from '@/lib/time';

import { type Medication, type MedicationLog, medicationLogs, medications } from '../schema';
import type { AppDb } from '../types';

export type MedicationInput = { name: string; type: MedicationType; defaultDose?: string | null };

function validate(input: MedicationInput): void {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 60) throw new Error('Medication name must be 1–60 characters');
  if (!MEDICATION_TYPE_KEYS.includes(input.type)) throw new Error(`Unknown medication type: ${input.type}`);
}

export function createMedication(db: AppDb, input: MedicationInput): number {
  validate(input);
  return db
    .insert(medications)
    .values({ name: input.name.trim(), type: input.type, defaultDose: input.defaultDose?.trim() || null })
    .returning({ id: medications.id })
    .get().id;
}

export function updateMedication(db: AppDb, id: number, input: MedicationInput): void {
  validate(input);
  db.update(medications)
    .set({
      name: input.name.trim(),
      type: input.type,
      defaultDose: input.defaultDose?.trim() || null,
      updatedAt: nowIso(),
    })
    .where(eq(medications.id, id))
    .run();
}

/** Hides a medication from "my meds" while keeping its history. */
export function archiveMedication(db: AppDb, id: number): void {
  db.update(medications).set({ active: false, updatedAt: nowIso() }).where(eq(medications.id, id)).run();
}

export function listMedications(db: AppDb, options: { includeArchived?: boolean } = {}): Medication[] {
  const query = db.select().from(medications);
  return (options.includeArchived ? query : query.where(eq(medications.active, true)))
    .orderBy(asc(sql`lower(${medications.name})`), asc(medications.id))
    .all();
}

/**
 * One-tap log of a saved medication. Name, type and dose are snapshotted so later
 * edits to the saved medication don't rewrite history.
 */
export function logMedication(
  db: AppDb,
  medicationId: number,
  options: { doseText?: string | null; takenAt?: string; tz?: string; notes?: string | null } = {},
): number {
  const medication = db.select().from(medications).where(eq(medications.id, medicationId)).get();
  if (!medication) throw new Error(`Medication ${medicationId} not found`);
  return db
    .insert(medicationLogs)
    .values({
      medicationId,
      name: medication.name,
      type: medication.type,
      doseText: options.doseText?.trim() || medication.defaultDose,
      takenAt: options.takenAt ?? nowIso(),
      tz: options.tz ?? currentTimeZone(),
      notes: options.notes?.trim() || null,
    })
    .returning({ id: medicationLogs.id })
    .get().id;
}

/** Medication logs with `from <= taken_at < to`, oldest first. */
export function listMedicationLogs(db: AppDb, range: { from: string; to: string }): MedicationLog[] {
  return db
    .select()
    .from(medicationLogs)
    .where(and(gte(medicationLogs.takenAt, range.from), lt(medicationLogs.takenAt, range.to)))
    .orderBy(asc(medicationLogs.takenAt), asc(medicationLogs.id))
    .all();
}

export function getMedicationLog(db: AppDb, id: number): MedicationLog | undefined {
  return db.select().from(medicationLogs).where(eq(medicationLogs.id, id)).get();
}

const MAX_DOSE_LENGTH = 40;
const MAX_NOTES_LENGTH = 500;

export type MedicationLogEdit = {
  /** When it was taken; the time zone becomes the current one. Omitted keeps the stored time. */
  takenAt?: string;
  /** Replaces the stored dose; blank clears it (a saved default is not filled back in). */
  doseText: string;
  notes: string;
};

/** Fixes a past dose from History: when it was taken, the dose and the note. */
export function updateMedicationLog(db: AppDb, logId: number, edit: MedicationLogEdit): void {
  const values: Partial<MedicationLog> = {
    doseText: edit.doseText.trim().slice(0, MAX_DOSE_LENGTH) || null,
    notes: edit.notes.trim().slice(0, MAX_NOTES_LENGTH) || null,
    updatedAt: nowIso(),
  };
  if (edit.takenAt !== undefined) {
    values.takenAt = edit.takenAt;
    values.tz = currentTimeZone();
  }
  const updated = db
    .update(medicationLogs)
    .set(values)
    .where(eq(medicationLogs.id, logId))
    .returning({ id: medicationLogs.id })
    .all();
  if (updated.length === 0) throw new Error(`Medication log ${logId} not found`);
}

export function deleteMedicationLog(db: AppDb, id: number): void {
  db.delete(medicationLogs).where(eq(medicationLogs.id, id)).run();
}
