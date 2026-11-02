import type { CuisineKey, RecipeTime } from '@/constants/cuisines';
import type { ConditionKey } from '@/constants/conditions';

/** One recipe, as the relay returns it (POST /v1/recipe-ideas) and as it is saved. Amounts are in US cups and spoons. */
export type Recipe = {
  title: string;
  /** Total time in minutes, prep included. */
  minutes: number;
  serves: number;
  /** Why it goes easy on the belly: a sentence or two. */
  why: string;
  /** One practical tip; may be empty. */
  tip: string;
  ingredients: string[];
  steps: string[];
  /**
   * Which of the five pictures it has (see lib/recipeLook). Chosen on the phone when the ideas arrive, never by the
   * recipe service, and kept with the recipe so it looks the same on the card, the page and the saved list.
   */
  look?: number;
};

/**
 * What is sent to get recipe ideas: the choices on the sheet, what the person is managing, and food names only.
 * Never symptom logs, notes, photos or the person's name. Mirrors the relay's `recipeIdeasBodySchema`.
 */
export type RecipeRequest = {
  cuisine: CuisineKey;
  time: RecipeTime;
  serves: number;
  conditions?: Exclude<ConditionKey, 'unsure'>[];
  /** Ingredients the person typed to use. */
  want?: string[];
  favorites?: string[];
  /** Foods that bothered them before. */
  triggers?: string[];
  /** Foods they never eat: a hard rule. */
  avoid?: string[];
  /** Dishes already shown this round, so "Generate more" gives new ones. */
  shown?: string[];
};

/** A change to one recipe's ingredients. Mirrors the relay's `recipeAdjustBodySchema`. */
export type RecipeChange =
  | { kind: 'swap'; ingredient: string; with?: string }
  | { kind: 'remove'; ingredient: string }
  | { kind: 'add'; ingredients: string[] };

/**
 * What is sent to change a recipe: the recipe itself (without the phone's own `look`), the change, what the person is
 * managing, and food names only. Mirrors the relay's `recipeAdjustBodySchema`.
 */
export type AdjustRequest = {
  recipe: Omit<Recipe, 'look'>;
  change: RecipeChange;
  conditions?: Exclude<ConditionKey, 'unsure'>[];
  triggers?: string[];
  avoid?: string[];
};
