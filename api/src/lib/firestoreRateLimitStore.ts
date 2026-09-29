import type { Firestore } from 'firebase-admin/firestore';

import { type RateLimitStore, utcDate } from './rateLimitStore.js';

export type FirestoreLike = Pick<Firestore, 'collection' | 'runTransaction'>;

export const RATE_LIMIT_COLLECTION = 'rate_limits';
const TTL_MS = 48 * 60 * 60 * 1000;

/**
 * One document per counter key and UTC day, e.g. `abc123_2026-09-29`. The key is URL-encoded so a uid containing `/` can't change the path.
 * `expiresAt` is for a Firestore TTL policy on the `rate_limits` collection (see docs/RUNBOOK.md),
 * so old counters are deleted automatically. Holds only a uid and a count, never content.
 */
export class FirestoreRateLimitStore implements RateLimitStore {
  constructor(private readonly db: FirestoreLike) {}

  async increment(key: string, now: Date): Promise<number> {
    const ref = this.db.collection(RATE_LIMIT_COLLECTION).doc(`${encodeURIComponent(key)}_${utcDate(now)}`);
    return this.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const current = snapshot.exists ? Number(snapshot.get('count') ?? 0) : 0;
      const next = current + 1;
      tx.set(ref, { count: next, expiresAt: new Date(now.getTime() + TTL_MS) });
      return next;
    });
  }
}
