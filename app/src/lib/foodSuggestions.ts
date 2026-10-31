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
