import { useEffect, useMemo, useState } from 'react';

import { useDb } from '@/db/DatabaseProvider';
import { getCachedInsight, insightKey, saveInsight } from '@/db/repositories/insightCache';
import { AppError } from '@/lib/errors';
import { fallbackInsight, insightHash } from '@/lib/insight';
import { logger } from '@/lib/logger';
import { fetchInsight } from '@/services/relayClient';
import type { Insight, InsightRange, InsightRequest } from '@/types/insight';

/** After a failed ask (offline, over the daily limit...), wait this long before asking again for the same thing. */
const RETRY_AFTER_MS = 5 * 60_000;
const failedAt = new Map<string, number>();

/** Conditions that are normal on a phone, so they are not reported as errors. */
const EXPECTED: readonly string[] = ['OFFLINE', 'NETWORK', 'RATE_LIMITED', 'SERVICE_BUSY', 'AI_TIMEOUT'];

/**
 * Bellie's summary of a day or week. Shows words made from the numbers at once (so the screen is never empty),
 * then the AI's summary once it arrives. A summary is only asked for again when what was logged changes: the
 * last one is kept on the phone, per day or week, and asked for again only when its `request` is different.
 *
 * `periodKey` is the day or the week's first day; `request` is null when nothing is logged (nothing to say).
 * Pass a memoised `request`.
 */
export function useInsight(
  range: InsightRange,
  periodKey: string,
  request: InsightRequest | null,
): Insight | null {
  const db = useDb();
  const key = insightKey(range, periodKey);
  const hash = useMemo(() => (request ? insightHash(request) : null), [request]);
  const [fresh, setFresh] = useState<{ key: string; hash: string; insight: Insight } | null>(null);

  const cached = useMemo(() => {
    if (!hash) return null;
    try {
      return getCachedInsight(db, key, hash);
    } catch {
      return null; // the words made locally still show
    }
  }, [db, key, hash]);
  const fallback = useMemo(() => (request ? fallbackInsight(request) : null), [request]);

  useEffect(() => {
    if (!request || !hash || cached) return;
    if (fresh?.key === key && fresh.hash === hash) return;
    const attempt = `${key}:${hash}`;
    const last = failedAt.get(attempt);
    if (last !== undefined && Date.now() - last < RETRY_AFTER_MS) return;

    const controller = new AbortController();
    fetchInsight(request, controller.signal)
      .then((insight) => {
        try {
          saveInsight(db, key, hash, insight);
        } catch (error) {
          logger.error('saveInsight', error);
        }
        setFresh({ key, hash, insight });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        failedAt.set(attempt, Date.now());
        if (error instanceof AppError && EXPECTED.includes(error.code)) logger.debug('fetchInsight');
        else logger.error('fetchInsight', error);
      });
    return () => controller.abort();
  }, [db, key, hash, request, cached, fresh]);

  if (fresh?.key === key && fresh.hash === hash) return fresh.insight;
  return cached ?? fallback;
}
