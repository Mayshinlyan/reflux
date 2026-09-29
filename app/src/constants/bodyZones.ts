import type { SymptomKey } from './symptomItems';

export type ZoneKey = 'throat' | 'chest' | 'tummy';

/**
 * Body areas shown on the symptom map. Tapping one lists only its own symptoms, so a
 * handful of choices are on screen at a time instead of all of them. Every symptom
 * still offered belongs to exactly one area (enforced by a test); see RETIRED_SYMPTOM_KEYS.
 */
export const BODY_ZONES: readonly { key: ZoneKey; label: string; symptoms: readonly SymptomKey[] }[] = [
  {
    key: 'throat',
    label: 'Throat & voice',
    symptoms: ['hoarseness', 'throat_clearing', 'mucus', 'swallowing', 'lump'],
  },
  { key: 'chest', label: 'Chest', symptoms: ['heartburn', 'breathing', 'cough_after_eating', 'cough'] },
  { key: 'tummy', label: 'Tummy', symptoms: ['stomach_pain', 'feeling_full', 'constipation'] },
];

export const zoneLabel = (zone: ZoneKey) => BODY_ZONES.find((z) => z.key === zone)?.label ?? zone;
export const zoneSymptoms = (zone: ZoneKey) => BODY_ZONES.find((z) => z.key === zone)?.symptoms ?? [];

/** Image the map is drawn on (app/assets/images/body/torso.png), in pixels. */
export const TORSO_IMAGE = { width: 433, height: 612 } as const;

/** Tappable areas drawn on the torso image, in image pixels. */
export const MAP_ZONES: readonly {
  key: ZoneKey;
  x: number;
  y: number;
  width: number;
  height: number;
}[] = [
  { key: 'throat', x: 185, y: 60, width: 100, height: 85 },
  { key: 'chest', x: 95, y: 150, width: 250, height: 135 },
  { key: 'tummy', x: 105, y: 295, width: 235, height: 285 },
];
