import { type NextFunction, type Request, type Response, Router } from 'express';
import type { Logger } from 'pino';

import { HttpError } from '../errors.js';
import { firebaseAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { uploadPhotos } from '../middleware/upload.js';
import { FRIDGE_PROMPT_VERSION } from '../prompts/fridgePrompt.js';
import { fridgeScanSchema, issueCodes, issuePaths } from '../schemas.js';
import { sanitizeImage } from '../services/imageSanitizer.js';
import type { AnalyzeDeps } from './analyze.routes.js';

/** The same kill switch as meal checks: answers SERVICE_BUSY before any auth, quota or Claude work happens. */
function killSwitch(enabled: boolean) {
  return (_req: Request, _res: Response, next: NextFunction) =>
    next(enabled ? undefined : new HttpError('SERVICE_BUSY'));
}

/** A bad model answer (truncated, no tool call, off-schema) is usually a one-off. */
const MAX_ATTEMPTS = 2;

/** Lowercase, one space between words, and each food once, in the order the model gave them. */
export function tidyItems(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const name = item.toLowerCase().replace(/\s+/g, ' ').trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/** Reads the food names out of one to three fridge photos (POST /v1/fridge-scan), on its own daily allowance. */
export function fridgeRoutes({ env, verifier, rateLimitStore, claude }: AnalyzeDeps) {
  const router = Router();

  async function scanWithRetry(jpegs: Buffer[], log: Logger): Promise<string[]> {
    for (let attempt = 1; ; attempt += 1) {
      let failure: HttpError;
      try {
        const { raw, telemetry } = await claude.fridge({ jpegs });
        const parsed = fridgeScanSchema.safeParse(raw);
        // Telemetry is numbers and ids only. Never the food names, and Zod failures are paths and codes, not values.
        log.info(
          {
            ...telemetry,
            attempt,
            kind: 'fridge',
            photos: jpegs.length,
            itemCount: parsed.success ? parsed.data.items.length : undefined,
            status: parsed.success ? 'ok' : 'invalid_output',
            zodPaths: parsed.success ? undefined : issuePaths(parsed.error),
            zodCodes: parsed.success ? undefined : issueCodes(parsed.error),
          },
          'claude call completed',
        );
        if (parsed.success) return tidyItems(parsed.data.items);
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
    '/v1/fridge-scan',
    killSwitch(env.ANALYSIS_ENABLED),
    firebaseAuth(verifier),
    rateLimit(
      rateLimitStore,
      { perUser: env.PER_USER_DAILY_FRIDGE_LIMIT, global: env.GLOBAL_DAILY_LIMIT },
      undefined,
      'fridge',
    ),
    uploadPhotos,
    async (req, res, next) => {
      try {
        const files = Array.isArray(req.files) ? req.files : [];
        if (files.length === 0) throw new HttpError('INPUT_REJECTED');
        const jpegs = await Promise.all(files.map((file) => sanitizeImage(file.buffer)));
        const items = await scanWithRetry(jpegs, res.locals.log);
        res.json({ items, meta: { model: claude.model, promptVersion: FRIDGE_PROMPT_VERSION } });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
