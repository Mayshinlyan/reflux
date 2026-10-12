import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../errors.js';
import { analyzeTextBodySchema, conditionsSchema, detailsSchema, portionSchema } from '../schemas.js';
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

/** Exactly one of `photo` (multipart) or `text` (JSON), each with optional `details`, `portion` and `conditions`. Output is the sanitized input for Claude. */
export async function validateInput(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.is('multipart/form-data')) {
      if (!req.file) throw new HttpError('INPUT_REJECTED');
      const fields = (req.body ?? {}) as Record<string, unknown>;
      if (Object.keys(fields).some((key) => key !== 'details' && key !== 'portion' && key !== 'conditions'))
        throw new HttpError('INPUT_REJECTED');
      const details = detailsSchema.optional().safeParse(fields.details);
      if (!details.success) throw new HttpError('INPUT_REJECTED');
      const portion = portionSchema.optional().safeParse(fields.portion);
      if (!portion.success) throw new HttpError('INPUT_REJECTED');
      // A multipart field is one string: the conditions comma separated.
      const conditions = conditionsSchema
        .optional()
        .safeParse(
          typeof fields.conditions === 'string'
            ? fields.conditions.split(',').filter(Boolean)
            : fields.conditions,
        );
      if (!conditions.success) throw new HttpError('INPUT_REJECTED');
      res.locals.analysisInput = {
        kind: 'photo',
        jpeg: await sanitizeImage(req.file.buffer),
        details: details.data,
        portion: portion.data,
        ...(conditions.data ? { conditions: conditions.data } : {}),
      };
    } else if (req.is('application/json')) {
      const parsed = analyzeTextBodySchema.safeParse(req.body);
      if (!parsed.success) throw new HttpError('INPUT_REJECTED');
      res.locals.analysisInput = {
        kind: 'text',
        text: parsed.data.text,
        details: parsed.data.details,
        portion: parsed.data.portion,
        ...(parsed.data.conditions ? { conditions: parsed.data.conditions } : {}),
      };
    } else {
      throw new HttpError('INPUT_REJECTED');
    }
    next();
  } catch (error) {
    next(error);
  }
}
