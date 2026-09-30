import { AppError, type ErrorCode } from './errors';
import { Sentry } from './sentry';

/**
 * App logger. In development it logs to the console; in production it reports to
 * Sentry with only an operation name and an error code — never data or messages
 * that could contain food, symptoms or medication details.
 */
export const logger = {
  debug(operation: string) {
    if (__DEV__) console.debug(`[${operation}]`);
  },

  error(operation: string, error: unknown) {
    const code: ErrorCode = error instanceof AppError ? error.code : 'INTERNAL';
    const requestId = error instanceof AppError ? error.requestId : undefined;
    if (__DEV__) {
      // warn, not error: handled errors shouldn't trigger the red LogBox error screen
      console.warn(`[${operation}] ${code}`, error);
      return;
    }
    Sentry.captureException(new Error(`${operation}: ${code}`), {
      tags: { operation, code, ...(requestId ? { requestId } : {}) },
    });
  },
};
