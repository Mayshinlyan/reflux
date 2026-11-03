import { asc, desc, eq, sql } from 'drizzle-orm';

import { cleanFoodName } from '@/lib/recipe';

import { type FridgeItem, fridgeItems } from '../schema';
import type { AppDb } from '../types';

/** Longest name, and how many the relay returns and accepts (its `fridgeScanSchema` and `recipeIdeasBodySchema`). */
export const MAX_FRIDGE_NAME = 40;
export const MAX_FRIDGE_ITEMS = 40;

/** The fridge, A to Z. */
export function listFridgeItems(db: AppDb): FridgeItem[] {
  return db
    .select()
    .from(fridgeItems)
    .orderBy(asc(sql`lower(${fridgeItems.name})`), asc(fridgeItems.id))
    .all();
}

/**
 * Replaces the whole fridge with what a new scan found (one transaction, so a failure leaves the old list). Names
 * are cleaned and de-duplicated ignoring capitals; blanks are dropped and at most 40 are kept. Returns how many.
 */
export function replaceFridge(db: AppDb, names: readonly string[]): number {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const name of names) {
    const value = cleanFoodName(name, MAX_FRIDGE_NAME);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    clean.push(value);
    if (clean.length >= MAX_FRIDGE_ITEMS) break;
  }
  db.transaction((tx) => {
    tx.delete(fridgeItems).run();
    for (const name of clean) tx.insert(fridgeItems).values({ name }).run();
  });
  return clean.length;
}

export function removeFridgeItem(db: AppDb, id: number): void {
  db.delete(fridgeItems).where(eq(fridgeItems.id, id)).run();
}

/** When the fridge was last scanned (an ISO time), or null when it holds nothing. */
export function fridgeUpdatedAt(db: AppDb): string | null {
  const newest = db
    .select({ at: fridgeItems.createdAt })
    .from(fridgeItems)
    .orderBy(desc(fridgeItems.createdAt))
    .limit(1)
    .get();
  return newest?.at ?? null;
}
