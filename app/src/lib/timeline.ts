import { LIFESTYLE_TAGS } from '@/constants/lifestyleTags';
import { MEDICATION_TYPES } from '@/constants/medicationTypes';
import { SYMPTOM_ITEMS } from '@/constants/symptomItems';
import type { StoredFoodLog } from '@/db/repositories/food';
import type { SymptomLogWithDetails } from '@/db/repositories/symptoms';
import type { MedicationLog } from '@/db/schema';

import { dayLabel, formatTime, localDayKey } from './localDay';

export type TimelineKind = 'symptom' | 'food' | 'medication';
export type TimelineFilter = 'all' | TimelineKind;

export type TimelineEntry =
  | {
      kind: 'symptom';
      id: number;
      at: string;
      tz: string;
      title: string;
      time: string;
      log: SymptomLogWithDetails;
    }
  | { kind: 'food'; id: number; at: string; tz: string; title: string; time: string; log: StoredFoodLog }
  | {
      kind: 'medication';
      id: number;
      at: string;
      tz: string;
      title: string;
      time: string;
      log: MedicationLog;
    };

export type TimelineSection = { dayKey: string; label: string; entries: TimelineEntry[] };

const symptomLabels = new Map<string, string>(SYMPTOM_ITEMS.map((item) => [item.key, item.label]));
const tagLabels = new Map<string, string>(LIFESTYLE_TAGS.map((tag) => [tag.key, tag.label]));
const medicationTypeLabels = new Map<string, string>(MEDICATION_TYPES.map((type) => [type.key, type.label]));

export const symptomLabel = (key: string) => symptomLabels.get(key) ?? key;
export const tagLabel = (key: string) => tagLabels.get(key) ?? key;
export const medicationTypeLabel = (key: string) => medicationTypeLabels.get(key) ?? key;

/**
 * Merges symptoms, meals and medications into day sections, newest day and newest
 * entry first. Each entry is placed on the local day of the zone it was logged in.
 */
export function buildTimeline(
  data: { symptoms: SymptomLogWithDetails[]; food: StoredFoodLog[]; medications: MedicationLog[] },
  filter: TimelineFilter = 'all',
  now: Date = new Date(),
  deviceTz?: string,
): TimelineSection[] {
  const entries: TimelineEntry[] = [];
  if (filter === 'all' || filter === 'symptom') {
    for (const log of data.symptoms) {
      entries.push({
        kind: 'symptom',
        id: log.id,
        at: log.loggedAt,
        tz: log.tz,
        title: log.items.map((item) => symptomLabel(item.key)).join(', '),
        time: formatTime(log.loggedAt, log.tz),
        log,
      });
    }
  }
  if (filter === 'all' || filter === 'food') {
    for (const log of data.food) {
      entries.push({
        kind: 'food',
        id: log.id,
        at: log.loggedAt,
        tz: log.tz,
        title: log.mealName,
        time: formatTime(log.loggedAt, log.tz),
        log,
      });
    }
  }
  if (filter === 'all' || filter === 'medication') {
    for (const log of data.medications) {
      entries.push({
        kind: 'medication',
        id: log.id,
        at: log.takenAt,
        tz: log.tz,
        title: log.doseText ? `${log.name} ${log.doseText}` : log.name,
        time: formatTime(log.takenAt, log.tz),
        log,
      });
    }
  }

  // ISO UTC strings sort chronologically; ties broken by kind + id for stability.
  entries.sort((a, b) => b.at.localeCompare(a.at) || a.kind.localeCompare(b.kind) || b.id - a.id);

  const sections: TimelineSection[] = [];
  for (const entry of entries) {
    const dayKey = localDayKey(entry.at, entry.tz);
    let section = sections.find((s) => s.dayKey === dayKey);
    if (!section) {
      section = { dayKey, label: dayLabel(dayKey, now, deviceTz), entries: [] };
      sections.push(section);
    }
    section.entries.push(entry);
  }
  // Entries from different zones can interleave; keep days in descending order.
  return sections.sort((a, b) => b.dayKey.localeCompare(a.dayKey));
}
