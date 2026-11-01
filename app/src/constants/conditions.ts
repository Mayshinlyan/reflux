import type { SymptomKey } from './symptomItems';

/** What the user is managing, pick all that apply (Figma 01c). Keys are stored in settings; never rename one. */
export const CONDITIONS = [
  {
    key: 'acid_reflux',
    label: 'Acid reflux or GERD',
    hint: 'Heartburn, sour taste, burping',
    feeling: 'Burning in my chest',
  },
  {
    key: 'lpr',
    label: 'Silent reflux (LPR)',
    hint: 'Hoarse voice, throat clearing',
    feeling: 'Hoarse voice, throat clearing',
  },
  {
    key: 'gastritis',
    label: 'Gastritis',
    hint: 'Stomach irritation, pain, feeling full',
    feeling: 'Stomach pain or feeling full',
  },
  {
    key: 'unsure',
    label: 'Not sure yet',
    hint: 'Track first, decide later',
    feeling: "I'm not sure yet",
  },
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

/** A stored list made safe to use: known keys only, once each, in card order, and "Not sure yet" only on its own. Null when nothing usable is left. */
export function readConditions(value: unknown): ConditionKey[] | null {
  if (!Array.isArray(value)) return null;
  const known = CONDITION_KEYS.filter((key) => value.includes(key));
  const real = known.filter((key) => key !== 'unsure');
  const result = real.length > 0 ? real : known;
  return result.length > 0 ? result : null;
}

/** Tap a card: "Not sure yet" clears the rest, and any other pick clears "Not sure yet". Never empty. */
export function toggleCondition(current: readonly ConditionKey[], key: ConditionKey): ConditionKey[] {
  if (key === 'unsure') return ['unsure'];
  const rest: ConditionKey[] = current.filter((item) => item !== 'unsure');
  const next = rest.includes(key) ? rest.filter((item) => item !== key) : [...rest, key];
  const ordered = CONDITION_KEYS.filter((item) => next.includes(item));
  return ordered.length > 0 ? ordered : ['unsure'];
}

/**
 * Onboarding's version of a tap (Figma 01c): nothing is picked to start, so the list can be empty. "Not sure yet"
 * clears the rest and any other pick clears "Not sure yet".
 */
export function pickCondition(current: readonly ConditionKey[], key: ConditionKey): ConditionKey[] {
  if (key === 'unsure') return current.includes('unsure') ? [] : ['unsure'];
  const rest: ConditionKey[] = current.filter((item) => item !== 'unsure');
  const next = rest.includes(key) ? rest.filter((item) => item !== key) : [...rest, key];
  return CONDITION_KEYS.filter((item) => next.includes(item));
}

/** What the relay is told: the real conditions, never "Not sure yet". */
export function conditionsForAnalysis(conditions: readonly ConditionKey[]): ConditionKey[] {
  return conditions.filter((item) => item !== 'unsure');
}

/** Symptoms to pre-select for these conditions, in no particular order. */
export function suggestedSymptoms(conditions: readonly ConditionKey[]): SymptomKey[] {
  return [...new Set(conditions.flatMap((item) => CONDITION_SYMPTOMS[item]))];
}

/** For spreading into an analyze request: the key is left out when there is nothing to tell the relay. */
export function analysisConditions(conditions: readonly ConditionKey[]): { conditions?: ConditionKey[] } {
  const real = conditionsForAnalysis(conditions);
  return real.length > 0 ? { conditions: real } : {};
}
