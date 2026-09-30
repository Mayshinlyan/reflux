import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../errors.js';
import { analyzeTextBodySchema, detailsSchema } from '../schemas.js';
import { sanitizeImage } from '../services/imageSanitizer.js';
import type { ClaudeInput } from '../services/claudeService.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      analysisInput: ClaudeInput;
    }
  }
}

/** Exactly one of `photo` (multipart) or `text` (JSON), each with optional `details`. Output is the sanitized input for Claude. */
export async function validateInput(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.is('multipart/form-data')) {
      if (!req.file) throw new HttpError('INPUT_REJECTED');
      const fields = (req.body ?? {}) as Record<string, unknown>;
      if (Object.keys(fields).some((key) => key !== 'details')) throw new HttpError('INPUT_REJECTED');
      const details = detailsSchema.optional().safeParse(fields.details);
      if (!details.success) throw new HttpError('INPUT_REJECTED');
      res.locals.analysisInput = {
        kind: 'photo',
        jpeg: await sanitizeImage(req.file.buffer),
        details: details.data,
      };
    } else if (req.is('application/json')) {
      const parsed = analyzeTextBodySchema.safeParse(req.body);
      if (!parsed.success) throw new HttpError('INPUT_REJECTED');
      res.locals.analysisInput = { kind: 'text', text: parsed.data.text, details: parsed.data.details };
    } else {
      throw new HttpError('INPUT_REJECTED');
    }
    next();
  } catch (error) {
    next(error);
  }
}
