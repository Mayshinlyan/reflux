import { listDiaryFoodLogs } from '@/db/repositories/food';
import { listMedicationLogs } from '@/db/repositories/medications';
import { listSymptomLogs } from '@/db/repositories/symptoms';
import type { AppDb } from '@/db/types';

import { inPeriod, loadWindow, type Period } from './range';
import { buildTimeline, type TimelineEntry, type TimelineSection } from './timeline';

const EPOCH = new Date(0).toISOString();

/**
 * Everything logged up to the end of `endKey`, by day, newest first. The weekly report reads the whole history, not
 * one week, so a food that was eaten twice in different weeks still counts.
 */
export function loadHistoryUpTo(db: AppDb, endKey: string, now: Date = new Date()): TimelineSection[] {
  const range = { from: EPOCH, to: loadWindow({ startKey: endKey, endKey }).to };
  return buildTimeline(
    {
      symptoms: listSymptomLogs(db, range),
      food: listDiaryFoodLogs(db, range),
      medications: listMedicationLogs(db, range),
    },
    'all',
    now,
  ).filter((section) => section.dayKey <= endKey);
}

export const entriesUpTo = (sections: readonly TimelineSection[], endKey: string): TimelineEntry[] =>
  sections.filter((section) => section.dayKey <= endKey).flatMap((section) => section.entries);

export const entriesIn = (sections: readonly TimelineSection[], period: Period): TimelineEntry[] =>
  sections.filter((section) => inPeriod(period, section.dayKey)).flatMap((section) => section.entries);
