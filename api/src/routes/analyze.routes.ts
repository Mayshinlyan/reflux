import { type NextFunction, type Request, type Response, Router } from 'express';
import type { Logger } from 'pino';

import type { Env } from '../config/env.js';
import { RULESET_VERSION } from '../config/ruleset.js';
import { HttpError } from '../errors.js';
import type { RateLimitStore } from '../lib/rateLimitStore.js';
import { firebaseAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { upload } from '../middleware/upload.js';
import { validateInput } from '../middleware/validateInput.js';
import { PROMPT_VERSION } from '../prompts/foodAnalysisPrompt.js';
import {
  type AnalysisMeta,
  issueCodes,
  issuePaths,
  type MealAnalysis,
  mealAnalysisSchema,
} from '../schemas.js';
import type { ClaudeInput, ClaudeService } from '../services/claudeService.js';
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

/** A bad model answer (truncated, no tool call, or off-schema) is usually a one-off, so try once more. */
const MAX_ANALYSIS_ATTEMPTS = 2;

export function analyzeRoutes({ env, verifier, rateLimitStore, claude }: AnalyzeDeps) {
  const router = Router();

  async function analyzeWithRetry(input: ClaudeInput, log: Logger): Promise<MealAnalysis> {
    for (let attempt = 1; ; attempt += 1) {
      let failure: HttpError;
      try {
        const { raw, telemetry } = await claude.analyze(input);
        const parsed = mealAnalysisSchema.safeParse(raw);
        // Telemetry is numbers and ids only. Zod failures are logged as paths and codes, never values.
        log.info(
          {
            ...telemetry,
            attempt,
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
      if (attempt >= MAX_ANALYSIS_ATTEMPTS) throw failure;
      log.warn({ attempt, ...failure.logContext }, 'invalid model output, retrying');
    }
  }

  router.post(
    '/v1/analyze-food',
    killSwitch(env.ANALYSIS_ENABLED),
    firebaseAuth(verifier),
    rateLimit(rateLimitStore, { perUser: env.PER_USER_DAILY_LIMIT, global: env.GLOBAL_DAILY_LIMIT }),
    upload,
    validateInput,
    async (_req, res, next) => {
      try {
        const analysis = await analyzeWithRetry(res.locals.analysisInput, res.locals.log);
        if (!analysis.isFood) throw new HttpError('NOT_FOOD');

        const meta: AnalysisMeta = {
          model: claude.model,
          promptVersion: PROMPT_VERSION,
          rulesetVersion: RULESET_VERSION,
        };
        res.json({ ...analysis, meta });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
