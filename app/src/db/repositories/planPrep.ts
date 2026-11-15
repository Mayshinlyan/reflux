import { eq } from 'drizzle-orm';

import { isPrepPlanResult } from '@/lib/prepPlan';
import { nowIso } from '@/lib/time';
import type { PrepPlanResult } from '@/types/prepPlan';

import { planPrep } from '../schema';
import type { AppDb } from '../types';

/** The saved prep session of a plan, when it was made for these dishes (the same signature); otherwise null. */
export function getPrepPlan(db: AppDb, planId: number, signature: string): PrepPlanResult | null {
  const row = db.select().from(planPrep).where(eq(planPrep.planId, planId)).get();
  if (!row || row.signature !== signature || !isPrepPlanResult(row.result)) return null;
  return row.result;
}

/** Keeps the prep session for a plan, replacing an older one. */
export function savePrepPlan(db: AppDb, planId: number, signature: string, result: PrepPlanResult): void {
  db.insert(planPrep)
    .values({ planId, signature, result })
    .onConflictDoUpdate({
      target: planPrep.planId,
      set: { signature, result, updatedAt: nowIso() },
    })
    .run();
}
