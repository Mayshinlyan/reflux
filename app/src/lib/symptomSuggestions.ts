import {
  type LoggedSymptomKey,
  RETIRED_SYMPTOM_KEYS,
  SYMPTOM_ITEMS,
  symptomKeyFromText,
} from '@/constants/symptomItems';

export const MAX_SYMPTOM_SUGGESTIONS = 5;

export type SymptomSuggestion = {
  key: LoggedSymptomKey;
  label: string;
  /** Where the typed text matches inside `label`, so it can be shown in bold. */
  matchStart: number;
  matchLength: number;
};

const startsWord = (name: string, index: number) => index === 0 || !/[\p{L}\p{N}]/u.test(name[index - 1]);

/**
 * The symptoms matching what is being typed (Figma 45i), like the food suggestions: the built-in ones, then
 * the user's own, each once; a match at the start of a word ranks above one in the middle.
 */
export function suggestSymptoms(
  query: string,
  ownLabels: readonly string[] = [],
  limit = MAX_SYMPTOM_SUGGESTIONS,
): SymptomSuggestion[] {
  const typed = query.trim().toLowerCase();
  if (!typed) return [];
  const labels = [
    ...SYMPTOM_ITEMS.filter((item) => !RETIRED_SYMPTOM_KEYS.includes(item.key)).map((item) => item.label),
    ...ownLabels,
  ];
  const seen = new Set<string>();
  const found: { suggestion: SymptomSuggestion; rank: number }[] = [];
  for (const label of labels) {
    const lower = label.trim().toLowerCase();
    if (!lower || seen.has(lower)) continue;
    seen.add(lower);
    const at = lower.indexOf(typed);
    const key = symptomKeyFromText(label);
    if (at < 0 || !key) continue;
    found.push({
      suggestion: { key, label, matchStart: at, matchLength: typed.length },
      rank: startsWord(lower, at) ? 0 : 1,
    });
  }
  return found
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((item) => item.suggestion);
}
