import { Router } from 'express';

import type { Env } from '../config/env.js';
import { HttpError } from '../errors.js';
import type { FeedbackStore } from '../lib/feedbackStore.js';
import type { RateLimitStore } from '../lib/rateLimitStore.js';
import { firebaseAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { feedbackBodySchema } from '../schemas.js';
import type { TokenVerifier } from '../services/tokenVerifier.js';

export type FeedbackDeps = {
  env: Env;
  verifier: TokenVerifier;
  rateLimitStore: RateLimitStore;
  feedbackStore: FeedbackStore;
};

/**
 * Feedback from the Settings sheet (POST /v1/feedback). No Claude call, so it has its own small daily allowance
 * per person and its own daily ceiling overall, and stays out of the circuit breaker that guards AI cost.
 * The message is never logged.
 */
export function feedbackRoutes({ env, verifier, rateLimitStore, feedbackStore }: FeedbackDeps) {
  const router = Router();

  router.post(
    '/v1/feedback',
    firebaseAuth(verifier),
    rateLimit(
      rateLimitStore,
      {
        perUser: env.PER_USER_DAILY_FEEDBACK_LIMIT,
        global: env.GLOBAL_DAILY_FEEDBACK_LIMIT,
        globalKey: 'feedback_global',
      },
      undefined,
      'feedback',
    ),
    async (req, res, next) => {
      try {
        const body = feedbackBodySchema.safeParse(req.body);
        if (!body.success) throw new HttpError('INPUT_REJECTED');
        await feedbackStore.add(body.data, new Date());
        res.locals.log.info({ kind: 'feedback', length: body.data.message.length }, 'feedback saved');
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
