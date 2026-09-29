/**
 * The 9 Reflux Symptom Index items (Belafsky et al., 2002) plus constipation and
 * trouble sleeping. Keys are stored in the database, so never rename one — add a new
 * key instead. Labels are the plain-language versions from the mockups.
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
  { key: 'constipation', label: 'Constipation', rsi: false },
  { key: 'sleep', label: 'Trouble sleeping', rsi: false },
] as const;

export type SymptomKey = (typeof SYMPTOM_ITEMS)[number]['key'];
export const SYMPTOM_KEYS = SYMPTOM_ITEMS.map((item) => item.key) as SymptomKey[];

/** Quick logs use 1–5; the RSI check-in (M2) scores 0–5. */
export const MIN_SCORE = 0;
export const MAX_SCORE = 5;
