import { asc, eq, sql } from 'drizzle-orm';

import { cleanFoodName } from '@/lib/recipe';

import { type AvoidFood, avoidFoods } from '../schema';
import type { AppDb } from '../types';

/** Longest name, and how many the relay will take in one request (its `recipeIdeasBodySchema`). */
export const MAX_AVOID_NAME = 40;
export const MAX_AVOID_FOODS = 30;

/** "I don't eat", A to Z. */
export function listAvoidFoods(db: AppDb): AvoidFood[] {
  return db
    .select()
    .from(avoidFoods)
    .orderBy(asc(sql`lower(${avoidFoods.name})`), asc(avoidFoods.id))
    .all();
}

/**
 * Adds a food the user never eats. A name already on the list (any capitals) changes nothing and returns the
 * existing row, so a second tap can't add a duplicate. Throws when the name is empty or the list is full.
 */
export function createAvoidFood(db: AppDb, name: string): AvoidFood {
  const clean = cleanFoodName(name, MAX_AVOID_NAME);
  if (!clean) throw new Error('A food needs a name');
  const existing = db
    .select()
    .from(avoidFoods)
    .where(sql`lower(${avoidFoods.name}) = lower(${clean})`)
    .get();
  if (existing) return existing;
  const total =
    db
      .select({ n: sql<number>`count(*)` })
      .from(avoidFoods)
      .get()?.n ?? 0;
  if (total >= MAX_AVOID_FOODS) throw new Error('The list is full');
  return db.insert(avoidFoods).values({ name: clean }).returning().get();
}

export function removeAvoidFood(db: AppDb, id: number): void {
  db.delete(avoidFoods).where(eq(avoidFoods.id, id)).run();
}
