import { describe, expect, it } from 'vitest';

import { FirestoreRateLimitStore, type FirestoreLike } from '../src/lib/firestoreRateLimitStore.js';
import { InMemoryRateLimitStore } from '../src/lib/rateLimitStore.js';

const DAY_1 = new Date('2026-09-29T10:00:00Z');
const DAY_1_LATE = new Date('2026-09-29T23:59:59Z');
const DAY_2 = new Date('2026-09-30T00:00:01Z');

describe('InMemoryRateLimitStore', () => {
  it('counts per key and resets each UTC day', async () => {
    const store = new InMemoryRateLimitStore();
    expect(await store.increment('user_a', DAY_1)).toBe(1);
    expect(await store.increment('user_a', DAY_1_LATE)).toBe(2);
    expect(await store.increment('user_b', DAY_1)).toBe(1);
    expect(await store.increment('user_a', DAY_2)).toBe(1);
  });
});

/** Minimal in-memory Firestore: enough of collection/doc/runTransaction for the store. */
function fakeFirestore() {
  const docs = new Map<string, Record<string, unknown>>();
  const db = {
    collection: (name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}` }) }),
    runTransaction: async (fn: (tx: unknown) => Promise<number>) =>
      fn({
        get: async (ref: { path: string }) => {
          const data = docs.get(ref.path);
          return { exists: data !== undefined, get: (field: string) => data?.[field] };
        },
        set: (ref: { path: string }, data: Record<string, unknown>) => {
          docs.set(ref.path, data);
        },
      }),
  };
  return { db: db as unknown as FirestoreLike, docs };
}

describe('FirestoreRateLimitStore', () => {
  it('keys documents by key and UTC date in the rate_limits collection', async () => {
    const { db, docs } = fakeFirestore();
    const store = new FirestoreRateLimitStore(db);

    await store.increment('user_abc', DAY_1);
    await store.increment('global', DAY_1);

    expect([...docs.keys()].sort()).toEqual([
      'rate_limits/global_2026-09-29',
      'rate_limits/user_abc_2026-09-29',
    ]);
  });

  it('increments atomically through a transaction and returns the new count', async () => {
    const { db, docs } = fakeFirestore();
    const store = new FirestoreRateLimitStore(db);

    expect(await store.increment('user_abc', DAY_1)).toBe(1);
    expect(await store.increment('user_abc', DAY_1_LATE)).toBe(2);
    expect(docs.get('rate_limits/user_abc_2026-09-29')?.count).toBe(2);
  });

  it('starts a fresh document on the next UTC day', async () => {
    const { db } = fakeFirestore();
    const store = new FirestoreRateLimitStore(db);

    await store.increment('user_abc', DAY_1);
    expect(await store.increment('user_abc', DAY_2)).toBe(1);
  });

  it('stores only a count and a 48 h expiry for the TTL policy', async () => {
    const { db, docs } = fakeFirestore();
    await new FirestoreRateLimitStore(db).increment('user_abc', DAY_1);

    const doc = docs.get('rate_limits/user_abc_2026-09-29');
    expect(Object.keys(doc ?? {}).sort()).toEqual(['count', 'expiresAt']);
    expect((doc?.expiresAt as Date).getTime() - DAY_1.getTime()).toBe(48 * 60 * 60 * 1000);
  });

  it('propagates Firestore errors (the middleware then fails closed)', async () => {
    const db = {
      collection: () => ({ doc: () => ({}) }),
      runTransaction: async () => {
        throw new Error('unavailable');
      },
    } as unknown as FirestoreLike;
    await expect(new FirestoreRateLimitStore(db).increment('user_abc', DAY_1)).rejects.toThrow('unavailable');
  });
});
