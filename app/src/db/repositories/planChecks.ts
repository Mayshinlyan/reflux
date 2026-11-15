import { and, asc, eq } from 'drizzle-orm';

import { nowIso } from '@/lib/time';

import { planChecks } from '../schema';
import type { AppDb } from '../types';

export type CheckKind = 'prep' | 'shop' | 'own';

/** What is ticked on a plan's prep day (`prep`) and shopping list (`shop`), and the items added by hand (`own`). */
export type PlanChecks = { prep: Set<string>; shop: Set<string>; own: string[] };

export function getPlanChecks(db: AppDb, planId: number): PlanChecks {
  const rows = db
    .select()
    .from(planChecks)
    .where(eq(planChecks.planId, planId))
    .orderBy(asc(planChecks.id))
    .all();
  const keys = (kind: CheckKind) => rows.filter((row) => row.kind === kind).map((row) => row.key);
  return { prep: new Set(keys('prep')), shop: new Set(keys('shop')), own: keys('own') };
}

/** Ticks or unticks one step or item. Ticking twice is the same as ticking once. */
export function setChecked(
  db: AppDb,
  planId: number,
  kind: 'prep' | 'shop',
  key: string,
  checked: boolean,
): void {
  if (checked) {
    db.insert(planChecks).values({ planId, kind, key }).onConflictDoNothing().run();
  } else {
    db.delete(planChecks)
      .where(and(eq(planChecks.planId, planId), eq(planChecks.kind, kind), eq(planChecks.key, key)))
      .run();
  }
}

/** Adds something to buy by hand. Blank or repeated text is ignored; returns whether it was added. */
export function addOwnItem(db: AppDb, planId: number, label: string): boolean {
  const key = label.trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!key) return false;
  const known = getPlanChecks(db, planId).own.some((own) => own.toLowerCase() === key.toLowerCase());
  if (known) return false;
  db.insert(planChecks).values({ planId, kind: 'own', key, createdAt: nowIso(), updatedAt: nowIso() }).run();
  return true;
}
