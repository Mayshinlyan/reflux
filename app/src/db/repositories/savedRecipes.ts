import { and, desc, eq } from 'drizzle-orm';

import type { CuisineKey } from '@/constants/cuisines';
import { isCuisineKey } from '@/constants/cuisines';
import { isRecipe, pickRecipe } from '@/lib/recipe';
import { nowIso } from '@/lib/time';
import type { Recipe } from '@/types/recipe';

import { type SavedRecipe, savedRecipes } from '../schema';
import type { AppDb } from '../types';

/** A saved recipe with its recipe parsed. */
export type StoredRecipe = {
  id: number;
  cuisine: CuisineKey;
  rating: 'up' | 'down' | null;
  recipe: Recipe;
};

/** A row whose stored recipe no longer has the right shape is skipped, not crashed on. */
function toStored(row: SavedRecipe): StoredRecipe | null {
  if (!isRecipe(row.recipe)) return null;
  return {
    id: row.id,
    cuisine: isCuisineKey(row.cuisine) ? row.cuisine : 'any',
    rating: row.rating,
    recipe: row.recipe,
  };
}

/** Saved recipes, newest first. */
export function listSavedRecipes(db: AppDb): StoredRecipe[] {
  return db
    .select()
    .from(savedRecipes)
    .orderBy(desc(savedRecipes.createdAt), desc(savedRecipes.id))
    .all()
    .map(toStored)
    .filter((stored): stored is StoredRecipe => stored !== null);
}

export function getSavedRecipe(db: AppDb, id: number): StoredRecipe | null {
  const row = db.select().from(savedRecipes).where(eq(savedRecipes.id, id)).get();
  return row ? toStored(row) : null;
}

/** The saved copy of a recipe the Kitchen just showed, if there is one (same name, same cuisine). */
export function findSavedRecipe(db: AppDb, title: string, cuisine: CuisineKey): StoredRecipe | null {
  const row = db
    .select()
    .from(savedRecipes)
    .where(and(eq(savedRecipes.title, title), eq(savedRecipes.cuisine, cuisine)))
    .get();
  return row ? toStored(row) : null;
}

/** Saves a recipe. Saving the same dish again (same name and cuisine) changes nothing and returns the saved one. */
export function saveRecipe(db: AppDb, recipe: Recipe, cuisine: CuisineKey): StoredRecipe {
  const existing = findSavedRecipe(db, recipe.title, cuisine);
  if (existing) return existing;
  const row = db
    .insert(savedRecipes)
    .values({
      title: recipe.title,
      cuisine,
      minutes: Math.round(recipe.minutes),
      serves: Math.round(recipe.serves),
      recipe: pickRecipe(recipe),
    })
    .returning()
    .get();
  return toStored(row) as StoredRecipe;
}

export function removeSavedRecipe(db: AppDb, id: number): void {
  db.delete(savedRecipes).where(eq(savedRecipes.id, id)).run();
}

/** The thumbs after cooking; null takes it back. */
export function setRecipeRating(db: AppDb, id: number, rating: 'up' | 'down' | null): void {
  db.update(savedRecipes).set({ rating, updatedAt: nowIso() }).where(eq(savedRecipes.id, id)).run();
}
