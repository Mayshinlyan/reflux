import type { NextFunction, Request, Response } from 'express';

import { errorBody, HttpError } from '../errors.js';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new HttpError('NOT_FOUND'));
}

/** Maps any thrown error to the error contract. Unknown errors become INTERNAL and are logged with a stack. */
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const httpError = toHttpError(error);
  if (httpError.status >= 500) {
    res.locals.log.error({ err: error, code: httpError.code }, 'request failed');
  } else {
    res.locals.log.warn({ code: httpError.code }, 'request rejected');
  }
  res.status(httpError.status).json(errorBody(httpError, res.locals.requestId));
}

function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  // body-parser errors carry a `type`; map them without echoing any of the input.
  const type = (error as { type?: unknown } | null)?.type;
  if (type === 'entity.too.large') return new HttpError('UPLOAD_TOO_LARGE');
  if (type === 'entity.parse.failed' || type === 'encoding.unsupported' || type === 'charset.unsupported') {
    return new HttpError('INPUT_REJECTED');
  }
  return new HttpError('INTERNAL');
}
