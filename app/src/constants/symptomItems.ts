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
  { key: 'burping', label: 'Burping', rsi: false },
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
 * A symptom the user typed ("Your own") is stored as `custom:<text>` in the same column as the built-in
 * keys, so entries, History and the summary treat it like any other symptom.
 */
export const CUSTOM_PREFIX = 'custom:';
export const MAX_CUSTOM_SYMPTOM = 40;
export type CustomSymptomKey = `custom:${string}`;
export type LoggedSymptomKey = SymptomKey | CustomSymptomKey;

export const isCustomSymptom = (key: string): key is CustomSymptomKey => key.startsWith(CUSTOM_PREFIX);

/** What was typed, tidied: inner spaces collapsed, trimmed, cut to the length limit. */
export const cleanCustomSymptom = (text: string) =>
  Array.from(text.replace(/\s+/g, ' ').trim()).slice(0, MAX_CUSTOM_SYMPTOM).join('').trim();

/** The text of a custom key; the key itself for a built-in one. */
export const customSymptomLabel = (key: string) =>
  isCustomSymptom(key) ? key.slice(CUSTOM_PREFIX.length) : key;

/**
 * The key for something typed in "Add your own": the built-in symptom when it names one (so typing
 * "heartburn" picks Heartburn), otherwise a custom key. Null when nothing usable was typed.
 */
export function symptomKeyFromText(text: string): LoggedSymptomKey | null {
  const clean = cleanCustomSymptom(text);
  if (!clean) return null;
  const builtIn = SYMPTOM_ITEMS.find(
    (item) => item.label.toLowerCase() === clean.toLowerCase() && !RETIRED_SYMPTOM_KEYS.includes(item.key),
  );
  return builtIn ? builtIn.key : `${CUSTOM_PREFIX}${clean}`;
}

/**
 * Scores are 0–5. The quick log records only that a symptom was felt (stored as
 * QUICK_LOG_SCORE); real severity scores arrive with the weekly RSI check-in (M2).
 */
export const MIN_SCORE = 0;
export const MAX_SCORE = 5;
export const QUICK_LOG_SCORE = 1;
