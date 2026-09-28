/**
 * Error contract: every error response is `{ error: { code, message, requestId } }`.
 * Codes are mirrored in app/src/lib/errors.ts, which maps each to a friendly UI message.
 */
export const ERROR_STATUS = {
  AUTH_FAILED: 401,
  RATE_LIMITED: 429,
  SERVICE_BUSY: 503,
  UPLOAD_TOO_LARGE: 413,
  INPUT_REJECTED: 400,
  NOT_FOOD: 422,
  NOT_FOUND: 404,
  AI_TIMEOUT: 504,
  AI_UPSTREAM_ERROR: 502,
  AI_INVALID_OUTPUT: 502,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

/** Short, content-free messages. The app shows its own friendly copy keyed by `code`. */
const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  AUTH_FAILED: 'Authentication failed.',
  RATE_LIMITED: 'Daily analysis limit reached.',
  SERVICE_BUSY: 'Analysis is temporarily unavailable.',
  UPLOAD_TOO_LARGE: 'Upload is too large.',
  INPUT_REJECTED: 'Input was rejected.',
  NOT_FOOD: 'No food was recognised.',
  NOT_FOUND: 'Not found.',
  AI_TIMEOUT: 'Analysis timed out.',
  AI_UPSTREAM_ERROR: 'Analysis service error.',
  AI_INVALID_OUTPUT: 'Analysis returned an invalid result.',
  INTERNAL: 'Internal error.',
};

export class HttpError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string = DEFAULT_MESSAGES[code],
  ) {
    super(message);
    this.name = 'HttpError';
    this.status = ERROR_STATUS[code];
  }
}

export type ErrorBody = { error: { code: ErrorCode; message: string; requestId: string } };

export function errorBody(error: HttpError, requestId: string): ErrorBody {
  return { error: { code: error.code, message: error.message, requestId } };
}
