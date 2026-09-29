/**
 * The 9 Reflux Symptom Index items (Belafsky et al., 2002) plus stomach pain, feeling
 * full, constipation and trouble sleeping. Keys are stored in the database, so never
 * rename one — add a new key instead. Labels are the plain-language versions from the
 * mockups. Which body area each belongs to lives in bodyZones.ts.
 */
export const SYMPTOM_ITEMS = [
  { key: 'hoarseness', label: 'Hoarse voice', rsi: true },
  { key: 'throat_clearing', label: 'Throat clearing', rsi: true },
  { key: 'mucus', label: 'Excess mucus', rsi: true },
  { key: 'swallowing', label: 'Trouble swallowing', rsi: true },
  { key: 'cough_after_eating', label: 'Cough after eating', rsi: true },
  { key: 'breathing', label: 'Breathing trouble', rsi: true },
  { key: 'cough', label: 'Nagging cough', rsi: true },
  { key: 'lump', label: 'Lump in throat', rsi: true },
  { key: 'heartburn', label: 'Heartburn', rsi: true },
  { key: 'stomach_pain', label: 'Stomach pain', rsi: false },
  { key: 'feeling_full', label: 'Feeling full', rsi: false },
  { key: 'constipation', label: 'Constipation', rsi: false },
  { key: 'sleep', label: 'Trouble sleeping', rsi: false },
] as const;

export type SymptomKey = (typeof SYMPTOM_ITEMS)[number]['key'];

/**
 * Symptoms no longer offered when logging but kept so entries saved earlier still show
 * (and can be edited). Trouble sleeping is now covered by the "Poor sleep" lifestyle tag.
 */
export const RETIRED_SYMPTOM_KEYS: readonly SymptomKey[] = ['sleep'];
export const SYMPTOM_KEYS = SYMPTOM_ITEMS.map((item) => item.key) as SymptomKey[];

/**
 * Scores are 0–5. The quick log records only that a symptom was felt (stored as
 * QUICK_LOG_SCORE); real severity scores arrive with the weekly RSI check-in (M2).
 */
export const MIN_SCORE = 0;
export const MAX_SCORE = 5;
export const QUICK_LOG_SCORE = 1;
