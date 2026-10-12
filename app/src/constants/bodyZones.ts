import type { ConditionKey } from './conditions';
import type { SymptomKey } from './symptomItems';

export type ZoneKey = 'throat' | 'chest' | 'tummy';

/**
 * Body areas the symptom screen groups its chips under, each with its own symptoms. Every
 * symptom still offered belongs to exactly one area (enforced by a test); see RETIRED_SYMPTOM_KEYS.
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

/** The area each condition shows first. */
const CONDITION_ZONE: Partial<Record<ConditionKey, ZoneKey>> = {
  lpr: 'throat',
  acid_reflux: 'chest',
  gastritis: 'tummy',
};

/** The areas with those of the chosen conditions first (in the order chosen); no condition keeps the default order. */
export function orderedZones(conditions: readonly ConditionKey[]): typeof BODY_ZONES {
  const first = conditions.flatMap((item) => CONDITION_ZONE[item] ?? []);
  return [
    ...BODY_ZONES.filter((zone) => first.includes(zone.key)).sort(
      (a, b) => first.indexOf(a.key) - first.indexOf(b.key),
    ),
    ...BODY_ZONES.filter((zone) => !first.includes(zone.key)),
  ];
}
