import { type NextFunction, type Request, type Response, Router } from 'express';
import type { Logger } from 'pino';

import { HttpError } from '../errors.js';
import { firebaseAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { INSIGHT_PROMPT_VERSION } from '../prompts/insightPrompt.js';
import {
  type Insight,
  type InsightInput,
  insightBodySchema,
  insightSchema,
  issueCodes,
  issuePaths,
} from '../schemas.js';
import type { AnalyzeDeps } from './analyze.routes.js';

/** The same kill switch as meal checks: answers SERVICE_BUSY before any auth, quota or Claude work happens. */
function killSwitch(enabled: boolean) {
  return (_req: Request, _res: Response, next: NextFunction) =>
    next(enabled ? undefined : new HttpError('SERVICE_BUSY'));
}

/** A bad model answer (truncated, no tool call, or off-schema) is usually a one-off, so try once more. */
const MAX_ATTEMPTS = 2;

/** Bellie's day and week summaries (POST /v1/insight), on their own daily allowance per person. */
export function insightRoutes({ env, verifier, rateLimitStore, claude }: AnalyzeDeps) {
  const router = Router();

  async function insightWithRetry(input: InsightInput, log: Logger): Promise<Insight> {
    for (let attempt = 1; ; attempt += 1) {
      let failure: HttpError;
      try {
        const { raw, telemetry } = await claude.insight(input);
        const parsed = insightSchema.safeParse(raw);
        // Telemetry is numbers and ids only. Zod failures are logged as paths and codes, never values.
        log.info(
          {
            ...telemetry,
            attempt,
            kind: 'insight',
            status: parsed.success ? 'ok' : 'invalid_output',
            zodPaths: parsed.success ? undefined : issuePaths(parsed.error),
            zodCodes: parsed.success ? undefined : issueCodes(parsed.error),
          },
          'claude call completed',
        );
        if (parsed.success) return parsed.data;
        failure = new HttpError('AI_INVALID_OUTPUT');
      } catch (error) {
        if (!(error instanceof HttpError && error.code === 'AI_INVALID_OUTPUT')) throw error;
        failure = error;
      }
      if (attempt >= MAX_ATTEMPTS) throw failure;
      log.warn({ attempt, ...failure.logContext }, 'invalid model output, retrying');
    }
  }

  router.post(
    '/v1/insight',
    killSwitch(env.ANALYSIS_ENABLED),
    firebaseAuth(verifier),
    rateLimit(
      rateLimitStore,
      { perUser: env.PER_USER_DAILY_INSIGHT_LIMIT, global: env.GLOBAL_DAILY_LIMIT },
      undefined,
      'insight',
    ),
    async (req, res, next) => {
      try {
        const body = insightBodySchema.safeParse(req.body);
        if (!body.success) throw new HttpError('INPUT_REJECTED');
        const insight = await insightWithRetry(body.data, res.locals.log);
        res.json({ ...insight, meta: { model: claude.model, promptVersion: INSIGHT_PROMPT_VERSION } });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
