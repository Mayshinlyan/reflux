import type { CuisineKey } from '@/constants/cuisines';
import type { Recipe } from '@/types/recipe';

/**
 * The recipe the person just picked from the ideas, held in memory for the recipe page to show. A recipe that was
 * saved is opened by its id instead, so this is only for one not saved (yet). It is gone when the app closes.
 */
export type RecipeDraft = { recipe: Recipe; cuisine: CuisineKey };

let draft: RecipeDraft | null = null;

export function setRecipeDraft(next: RecipeDraft | null): void {
  draft = next;
}

export function getRecipeDraft(): RecipeDraft | null {
  return draft;
}
