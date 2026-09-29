import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../errors.js';
import type { TokenVerifier } from '../services/tokenVerifier.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      uid: string;
    }
  }
}

/** Requires `Authorization: Bearer <Firebase ID token>`. Any failure is AUTH_FAILED with no detail. */
export function firebaseAuth(verifier: TokenVerifier) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const match = /^Bearer (\S+)$/.exec(req.get('authorization') ?? '');
    if (!match?.[1]) return next(new HttpError('AUTH_FAILED', undefined, { reason: 'missing-bearer' }));
    try {
      const { uid } = await verifier.verify(match[1]);
      res.locals.uid = uid;
      next();
    } catch (error) {
      // Log the verifier's error code (e.g. auth/argument-error), never the token or its message.
      const code = (error as { code?: unknown } | null)?.code;
      next(
        new HttpError('AUTH_FAILED', undefined, {
          reason: typeof code === 'string' ? code : 'unknown',
        }),
      );
    }
  };
}
