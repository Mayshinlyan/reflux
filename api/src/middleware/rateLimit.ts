import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../errors.js';
import { GLOBAL_KEY, type RateLimitStore } from '../lib/rateLimitStore.js';

type Limits = { perUser: number; global: number };

/**
 * Per-user daily limit (429 RATE_LIMITED) plus a global daily circuit breaker (503 SERVICE_BUSY).
 * Every accepted request counts, whether or not the analysis later succeeds, because it may cost money.
 * A store failure fails closed as SERVICE_BUSY so a Firestore outage can't disable the cost caps.
 */
export function rateLimit(store: RateLimitStore, limits: Limits, now: () => Date = () => new Date()) {
  return async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const when = now();
      const userCount = await store.increment(`user_${res.locals.uid}`, when);
      if (userCount > limits.perUser) return next(new HttpError('RATE_LIMITED'));
      const globalCount = await store.increment(GLOBAL_KEY, when);
      if (globalCount > limits.global) {
        res.locals.log.warn({ limit: limits.global }, 'global circuit breaker tripped');
        return next(new HttpError('SERVICE_BUSY'));
      }
      next();
    } catch (error) {
      res.locals.log.error({ err: error }, 'rate limit store failed');
      next(new HttpError('SERVICE_BUSY'));
    }
  };
}
