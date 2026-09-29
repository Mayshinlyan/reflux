import { type NextFunction, type Request, type Response, Router } from 'express';

import type { Env } from '../config/env.js';
import { RULESET_VERSION } from '../config/ruleset.js';
import { HttpError } from '../errors.js';
import type { RateLimitStore } from '../lib/rateLimitStore.js';
import { firebaseAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { upload } from '../middleware/upload.js';
import { validateInput } from '../middleware/validateInput.js';
import { PROMPT_VERSION } from '../prompts/foodAnalysisPrompt.js';
import { type AnalysisMeta, issuePaths, mealAnalysisSchema } from '../schemas.js';
import type { ClaudeService } from '../services/claudeService.js';
import type { TokenVerifier } from '../services/tokenVerifier.js';

export type AnalyzeDeps = {
  env: Env;
  verifier: TokenVerifier;
  rateLimitStore: RateLimitStore;
  claude: ClaudeService;
};

/** Kill switch: answers SERVICE_BUSY before any auth, quota or Claude work happens. */
function killSwitch(enabled: boolean) {
  return (_req: Request, _res: Response, next: NextFunction) =>
    next(enabled ? undefined : new HttpError('SERVICE_BUSY'));
}

export function analyzeRoutes({ env, verifier, rateLimitStore, claude }: AnalyzeDeps) {
  const router = Router();

  router.post(
    '/v1/analyze-food',
    killSwitch(env.ANALYSIS_ENABLED),
    firebaseAuth(verifier),
    rateLimit(rateLimitStore, { perUser: env.PER_USER_DAILY_LIMIT, global: env.GLOBAL_DAILY_LIMIT }),
    upload,
    validateInput,
    async (_req, res, next) => {
      try {
        const { raw, telemetry } = await claude.analyze(res.locals.analysisInput);
        const parsed = mealAnalysisSchema.safeParse(raw);
        // Telemetry is numbers and ids only. Zod failures are logged as paths, never values.
        res.locals.log.info(
          {
            ...telemetry,
            status: parsed.success ? 'ok' : 'invalid_output',
            zodPaths: parsed.success ? undefined : issuePaths(parsed.error),
          },
          'claude call completed',
        );
        if (!parsed.success) throw new HttpError('AI_INVALID_OUTPUT');
        if (!parsed.data.isFood) throw new HttpError('NOT_FOOD');

        const meta: AnalysisMeta = {
          model: claude.model,
          promptVersion: PROMPT_VERSION,
          rulesetVersion: RULESET_VERSION,
        };
        res.json({ ...parsed.data, meta });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
