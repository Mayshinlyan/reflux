/** Daily counters. `increment` must be atomic and returns the new count. */
export interface RateLimitStore {
  increment(key: string, now: Date): Promise<number>;
}

export const GLOBAL_KEY = 'global';

/** Counter buckets roll over at UTC midnight. */
export function utcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly counts = new Map<string, number>();

  async increment(key: string, now: Date): Promise<number> {
    const bucket = `${key}:${utcDate(now)}`;
    const next = (this.counts.get(bucket) ?? 0) + 1;
    this.counts.set(bucket, next);
    return next;
  }
}
