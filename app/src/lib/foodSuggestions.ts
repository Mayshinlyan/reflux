export const MAX_SUGGESTIONS = 5;

export type FoodSuggestion = {
  name: string;
  /** A favorite food logs at once; the others fill the field. */
  source: 'favorite' | 'recent' | 'common';
  /** The saved food's id, for a favorite. */
  id?: number;
  /** Where the typed text matches inside `name`, so it can be shown in bold. */
  matchStart: number;
  matchLength: number;
};

type Sources = {
  saved: readonly { id: number; name: string }[];
  /** Past diary meal names, most recent first. */
  recent: readonly string[];
  common: readonly string[];
};

const startsWord = (name: string, index: number) => index === 0 || !/[\p{L}\p{N}]/u.test(name[index - 1]);

/**
 * Up to `limit` foods matching what is being typed (Figma row 20), shown favorites first, then A to Z. Which ones make the cut: favorites
 * first, then past meals, then common foods, each name once. A match at the start of a word ranks above one in the middle; ties keep that source order.
 * A food typed out in full is not suggested back, except a favorite, which is the one-tap way to log it.
 */
export function suggestFoods(query: string, sources: Sources, limit = MAX_SUGGESTIONS): FoodSuggestion[] {
  const typed = query.trim().toLowerCase();
  if (!typed) return [];
  const seen = new Set<string>();
  const found: { suggestion: FoodSuggestion; rank: number }[] = [];
  const consider = (name: string, source: FoodSuggestion['source'], id?: number) => {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    const at = key.indexOf(typed);
    if (at < 0 || (key === typed && source !== 'favorite')) return;
    found.push({
      suggestion: { name, source, id, matchStart: at, matchLength: typed.length },
      rank: startsWord(key, at) ? 0 : 1,
    });
  };
  for (const food of sources.saved) consider(food.name, 'favorite', food.id);
  for (const name of sources.recent) consider(name, 'recent');
  for (const name of sources.common) consider(name, 'common');
  // Array.prototype.sort is stable, so equal ranks keep the source order above. That picks the best few; they are
  // then shown favorites first and A to Z within each group, so the list is easy to scan.
  return found
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((item) => item.suggestion)
    .sort(
      (a, b) =>
        Number(b.source === 'favorite') - Number(a.source === 'favorite') ||
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
}

/** Words at the end of the text tried as the food being named, longest first. */
const MAX_PHRASE_WORDS = 3;

/**
 * Suggestions for free text that mentions a food ("it's pumpkin so"), as in the "Not quite right?" sheet
 * (Figma row 23). Only the part after the last comma counts; its last 3, then 2, then 1 words are tried as the
 * query and the first that finds foods wins. `replaceFrom` is where those words start in `text`.
 * Nothing is suggested after a space or comma (the word is finished), or once the words are a food in full.
 */
export function suggestForPhrase(
  text: string,
  sources: Sources,
  limit = MAX_SUGGESTIONS,
): { suggestions: FoodSuggestion[]; replaceFrom: number } {
  const none = { suggestions: [], replaceFrom: text.length };
  if (/[\s,]$/.test(text)) return none;
  const segmentStart = text.lastIndexOf(',') + 1;
  const words = [...text.slice(segmentStart).matchAll(/\S+/g)];
  const everyName = [...sources.saved.map((food) => food.name), ...sources.recent, ...sources.common].map(
    (name) => name.trim().toLowerCase(),
  );
  for (let count = Math.min(MAX_PHRASE_WORDS, words.length); count >= 1; count--) {
    const start = segmentStart + (words[words.length - count].index ?? 0);
    const phrase = text.slice(start).trim();
    if (phrase.length < 2) continue;
    const typed = phrase.toLowerCase();
    const suggestions = suggestFoods(phrase, sources, limit).filter(
      (item) => item.name.trim().toLowerCase() !== typed,
    );
    if (suggestions.length > 0) return { suggestions, replaceFrom: start };
    if (everyName.includes(typed)) return none; // a food in full: done, don't fall back to its last word
  }
  return none;
}

/** The text with the typed words replaced by the picked food, and a space so typing carries on. */
export function applySuggestion(text: string, replaceFrom: number, name: string): string {
  return `${text.slice(0, replaceFrom)}${name} `;
}
