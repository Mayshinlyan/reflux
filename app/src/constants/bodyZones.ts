import type { SymptomKey } from './symptomItems';

export type ZoneKey = 'throat' | 'chest' | 'tummy';

/**
 * Body areas offered as tabs on the symptom screen. Choosing one lists only its own symptoms, so a
 * handful of choices are on screen at a time instead of all of them. Every symptom
 * still offered belongs to exactly one area (enforced by a test); see RETIRED_SYMPTOM_KEYS.
 */
export const BODY_ZONES: readonly { key: ZoneKey; label: string; symptoms: readonly SymptomKey[] }[] = [
  {
    key: 'throat',
    label: 'Throat & voice',
    symptoms: ['hoarseness', 'throat_clearing', 'mucus', 'swallowing', 'lump'],
  },
  {
    key: 'chest',
    label: 'Chest',
    symptoms: ['heartburn', 'burping', 'breathing', 'cough_after_eating', 'cough'],
  },
  { key: 'tummy', label: 'Tummy', symptoms: ['stomach_pain', 'feeling_full', 'constipation'] },
];

export const zoneLabel = (zone: ZoneKey) => BODY_ZONES.find((z) => z.key === zone)?.label ?? zone;
export const zoneSymptoms = (zone: ZoneKey) => BODY_ZONES.find((z) => z.key === zone)?.symptoms ?? [];
