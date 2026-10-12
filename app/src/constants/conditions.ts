import type { SymptomKey } from './symptomItems';

/** What the user is managing, pick all that apply (Figma 01c). Keys are stored in settings; never rename one. */
export const CONDITIONS = [
  {
    key: 'acid_reflux',
    label: 'Acid reflux or GERD',
    short: 'acid reflux',
    hint: 'Heartburn, sour taste, burping',
  },
  { key: 'lpr', label: 'Silent reflux (LPR)', short: 'silent reflux', hint: 'Hoarse voice, throat clearing' },
  {
    key: 'gastritis',
    label: 'Gastritis',
    short: 'gastritis',
    hint: 'Stomach irritation, pain, feeling full',
  },
  { key: 'unsure', label: 'Not sure yet', short: '', hint: 'Track first, decide later' },
] as const;

export type ConditionKey = (typeof CONDITIONS)[number]['key'];
export const CONDITION_KEYS = CONDITIONS.map((condition) => condition.key) as ConditionKey[];

/** Symptoms each condition usually brings, used to pre-select the usual symptoms. */
export const CONDITION_SYMPTOMS: Record<ConditionKey, readonly SymptomKey[]> = {
  acid_reflux: ['heartburn', 'burping'],
  lpr: ['hoarseness', 'throat_clearing', 'mucus', 'swallowing', 'cough', 'lump'],
  gastritis: ['stomach_pain', 'feeling_full'],
  unsure: [],
};

/** Saved before conditions became a list: `gerd` was its own choice, now merged into acid reflux. */
export function legacyCondition(value: unknown): ConditionKey | null {
  if (value === 'gerd') return 'acid_reflux';
  return CONDITION_KEYS.includes(value as ConditionKey) ? (value as ConditionKey) : null;
}

/** Tap a card: "Not sure yet" clears the rest, and any other pick clears "Not sure yet". Never empty. */
export function toggleCondition(current: readonly ConditionKey[], key: ConditionKey): ConditionKey[] {
  if (key === 'unsure') return ['unsure'];
  const rest: ConditionKey[] = current.filter((item) => item !== 'unsure');
  const next = rest.includes(key) ? rest.filter((item) => item !== key) : [...rest, key];
  const ordered = CONDITION_KEYS.filter((item) => next.includes(item));
  return ordered.length > 0 ? ordered : ['unsure'];
}

/** The line under the name on the Profile, e.g. "Managing acid reflux and silent reflux". */
export function managingLine(conditions: readonly ConditionKey[]): string {
  const names = CONDITIONS.filter((item) => item.short && conditions.includes(item.key)).map(
    (item) => item.short,
  );
  if (names.length === 0) return 'Just tracking for now';
  const list =
    names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return `Managing ${list}`;
}

/** The labels to show on the Profile card. */
export function conditionLabels(conditions: readonly ConditionKey[]): string {
  return CONDITIONS.filter((item) => conditions.includes(item.key))
    .map((item) => item.label)
    .join(', ');
}

/** What the relay is told: the real conditions, never "Not sure yet". */
export function conditionsForAnalysis(conditions: readonly ConditionKey[]): ConditionKey[] {
  return conditions.filter((item) => item !== 'unsure');
}

/** Symptoms to pre-select for these conditions, in no particular order. */
export function suggestedSymptoms(conditions: readonly ConditionKey[]): SymptomKey[] {
  return [...new Set(conditions.flatMap((item) => CONDITION_SYMPTOMS[item]))];
}
