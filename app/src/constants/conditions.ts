/** What the user is managing (Figma 01c). Keys are stored in settings; never rename one. */
export const CONDITIONS = [
  { key: 'acid_reflux', label: 'Acid reflux', hint: 'Heartburn, sour taste, burping' },
  { key: 'gerd', label: 'GERD', hint: 'Frequent or long-term reflux' },
  { key: 'lpr', label: 'LPR (silent reflux)', hint: 'Hoarse voice, throat clearing' },
  { key: 'gastritis', label: 'Gastritis', hint: 'Stomach lining irritation' },
  { key: 'unsure', label: 'Not sure yet', hint: 'Track first, decide later' },
] as const;

export type ConditionKey = (typeof CONDITIONS)[number]['key'];
export const CONDITION_KEYS = CONDITIONS.map((condition) => condition.key) as ConditionKey[];
