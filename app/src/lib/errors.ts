/**
 * Relay error codes, mirrored from api/src/errors.ts. Each maps to a friendly,
 * non-alarming message shown in the UI.
 */
export const ERROR_CODES = [
  'AUTH_FAILED',
  'RATE_LIMITED',
  'SERVICE_BUSY',
  'UPLOAD_TOO_LARGE',
  'INPUT_REJECTED',
  'NOT_FOOD',
  'NOT_FOUND',
  'AI_TIMEOUT',
  'AI_UPSTREAM_ERROR',
  'AI_INVALID_OUTPUT',
  'INTERNAL',
] as const;

/** Client-only codes (never returned by the relay). */
export const CLIENT_ERROR_CODES = ['OFFLINE', 'NETWORK'] as const;

export type RelayErrorCode = (typeof ERROR_CODES)[number];
export type ErrorCode = RelayErrorCode | (typeof CLIENT_ERROR_CODES)[number];

export const friendlyMessages: Record<ErrorCode, string> = {
  AUTH_FAILED: "We couldn't connect just now. Please try again in a moment.",
  RATE_LIMITED: "You've reached today's limit for food checks. You can still log everything by hand.",
  SERVICE_BUSY: 'Food checks are taking a short break. Please try again later.',
  UPLOAD_TOO_LARGE: 'That photo is a bit too big. Try taking a new one.',
  INPUT_REJECTED: "We couldn't read that. Try describing the food in a few words.",
  NOT_FOOD: "That doesn't look like food to us. Try another photo or type it in.",
  NOT_FOUND: 'Something went wrong. Please try again.',
  AI_TIMEOUT: 'That took longer than expected. Please try again.',
  AI_UPSTREAM_ERROR: 'Something went wrong looking at your food. Please try again.',
  AI_INVALID_OUTPUT: 'Something went wrong looking at your food. Please try again.',
  INTERNAL: 'Something went wrong. Please try again.',
  OFFLINE: 'Checking food needs an internet connection. Your logs still save offline.',
  NETWORK: "We couldn't reach the server. Please check your connection and try again.",
};

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly requestId?: string,
  ) {
    super(code);
    this.name = 'AppError';
  }

  get friendlyMessage(): string {
    return friendlyMessages[this.code];
  }
}

export function isRelayErrorCode(value: unknown): value is RelayErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}
