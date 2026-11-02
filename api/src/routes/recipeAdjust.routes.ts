import { Router } from 'express';
import type { Logger } from 'pino';

import { HttpError } from '../errors.js';
import { firebaseAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ADJUST_PROMPT_VERSION } from '../prompts/recipeAdjustPrompt.js';
import {
  issueCodes,
  issuePaths,
  type Recipe,
  type RecipeAdjustInput,
  recipeAdjustBodySchema,
  recipeAdjustSchema,
} from '../schemas.js';
import type { AnalyzeDeps } from './analyze.routes.js';
import { breaksNeverEat, killSwitch } from './recipes.routes.js';

/** A bad model answer (truncated, no tool call, off-schema, or a never-eat food) is usually a one-off. */
const MAX_ATTEMPTS = 2;

/** Ingredient edits for the Kitchen (POST /v1/recipe-adjust), on their own daily allowance per person. */
export function recipeAdjustRoutes({ env, verifier, rateLimitStore, claude }: AnalyzeDeps) {
  const router = Router();

  async function adjustWithRetry(input: RecipeAdjustInput, log: Logger): Promise<Recipe> {
    for (let attempt = 1; ; attempt += 1) {
      let failure: HttpError;
      try {
        const { raw, telemetry } = await claude.adjust(input);
        const parsed = recipeAdjustSchema.safeParse(raw);
        // Telemetry is numbers and ids only. Zod failures are logged as paths and codes, never values.
        log.info(
          {
            ...telemetry,
            attempt,
            kind: 'recipe_adjust',
            status: parsed.success ? 'ok' : 'invalid_output',
            zodPaths: parsed.success ? undefined : issuePaths(parsed.error),
            zodCodes: parsed.success ? undefined : issueCodes(parsed.error),
          },
          'claude call completed',
        );
        if (parsed.success) {
          if (!breaksNeverEat(parsed.data.recipe, input.avoid)) return parsed.data.recipe;
          log.warn({ attempt }, 'recipe dropped by never-eat check');
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
    '/v1/recipe-adjust',
    killSwitch(env.ANALYSIS_ENABLED),
    firebaseAuth(verifier),
    rateLimit(
      rateLimitStore,
      { perUser: env.PER_USER_DAILY_ADJUST_LIMIT, global: env.GLOBAL_DAILY_LIMIT },
      undefined,
      'adjust',
    ),
    async (req, res, next) => {
      try {
        const body = recipeAdjustBodySchema.safeParse(req.body);
        if (!body.success) throw new HttpError('INPUT_REJECTED');
        const recipe = await adjustWithRetry(body.data, res.locals.log);
        res.json({ recipe, meta: { model: claude.model, promptVersion: ADJUST_PROMPT_VERSION } });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
