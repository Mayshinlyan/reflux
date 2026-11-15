import { type NextFunction, type Request, type Response, Router } from 'express';
import type { Logger } from 'pino';

import { HttpError } from '../errors.js';
import { firebaseAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { PREP_PLAN_PROMPT_VERSION } from '../prompts/prepPlanPrompt.js';
import {
  issueCodes,
  issuePaths,
  type PrepPlan,
  type PrepPlanInput,
  prepPlanBodySchema,
  prepPlanSchema,
} from '../schemas.js';
import type { AnalyzeDeps } from './analyze.routes.js';

/** The same kill switch as meal checks: answers SERVICE_BUSY before any auth, quota or Claude work happens. */
function killSwitch(enabled: boolean) {
  return (_req: Request, _res: Response, next: NextFunction) =>
    next(enabled ? undefined : new HttpError('SERVICE_BUSY'));
}

/** A bad model answer (truncated, no tool call, off-schema, a dish missing) is usually a one-off. */
const MAX_ATTEMPTS = 2;

/**
 * True when the session covers every dish that was sent exactly once, and every step points only at dishes that
 * were sent. Anything else would leave a dish with no steps listed or a step for a dish that is not there.
 */
export function prepFitsRequest(plan: PrepPlan, input: PrepPlanInput): boolean {
  const asked = new Set(input.dishes.map((dish) => dish.id));
  const covered = new Set(plan.dishes.map((entry) => entry.dish));
  if (covered.size !== plan.dishes.length || covered.size !== asked.size) return false;
  for (const id of covered) if (!asked.has(id)) return false;
  const steps = [...plan.start, ...plan.finish];
  if (!steps.every((step) => step.feeds.every((id) => asked.has(id)))) return false;
  // A session with nothing to do at all is no plan.
  return steps.length + plan.dishes.reduce((sum, entry) => sum + entry.steps.length, 0) > 0;
}

/** One efficient prep session for the week's dishes (POST /v1/prep-plan), on its own daily allowance per person. */
export function prepPlanRoutes({ env, verifier, rateLimitStore, claude }: AnalyzeDeps) {
  const router = Router();

  async function planWithRetry(input: PrepPlanInput, log: Logger): Promise<PrepPlan> {
    for (let attempt = 1; ; attempt += 1) {
      let failure: HttpError;
      try {
        const { raw, telemetry } = await claude.prepPlan(input);
        const parsed = prepPlanSchema.safeParse(raw);
        // Telemetry is numbers and ids only. Zod failures are logged as paths and codes, never values.
        log.info(
          {
            ...telemetry,
            attempt,
            kind: 'prep-plan',
            status: parsed.success ? 'ok' : 'invalid_output',
            zodPaths: parsed.success ? undefined : issuePaths(parsed.error),
            zodCodes: parsed.success ? undefined : issueCodes(parsed.error),
          },
          'claude call completed',
        );
        if (parsed.success) {
          if (prepFitsRequest(parsed.data, input)) return parsed.data;
          log.warn({ attempt }, 'prep plan does not cover the dishes sent');
        }
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
    '/v1/prep-plan',
    killSwitch(env.ANALYSIS_ENABLED),
    firebaseAuth(verifier),
    rateLimit(
      rateLimitStore,
      { perUser: env.PER_USER_DAILY_PREP_LIMIT, global: env.GLOBAL_DAILY_LIMIT },
      undefined,
      'prep-plan',
    ),
    async (req, res, next) => {
      try {
        const body = prepPlanBodySchema.safeParse(req.body);
        if (!body.success) throw new HttpError('INPUT_REJECTED');
        const plan = await planWithRetry(body.data, res.locals.log);
        res.json({ ...plan, meta: { model: claude.model, promptVersion: PREP_PLAN_PROMPT_VERSION } });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
