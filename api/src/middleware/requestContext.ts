import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';
import type { Logger } from 'pino';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      requestId: string;
      log: Logger;
    }
  }
}

/**
 * Accepts the client's X-Request-Id (or mints one), echoes it on the response and
 * attaches a child logger so every log line carries it. Logs one content-free line
 * per request: method, route, status and latency — never the body or query string.
 */
export function requestContext(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.get('x-request-id');
    const requestId = incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
    const started = process.hrtime.bigint();

    res.locals.requestId = requestId;
    res.locals.log = logger.child({ requestId });
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
      const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
      res.locals.log.info(
        { method: req.method, path: req.route?.path ?? 'unmatched', status: res.statusCode, latencyMs },
        'request completed',
      );
    });
    next();
  };
}
