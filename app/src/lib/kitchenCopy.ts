import type { ErrorCode } from '@/lib/errors';

/**
 * The line under the ideas sheet's choices, so you can see your "Foods to avoid" list is being respected (Figma 29b).
 * Empty when the list is empty. Names come in as saved; the first two are listed, the rest counted.
 */
export function skipsLine(names: readonly string[]): string {
  const lower = names.map((name) => name.toLowerCase());
  if (lower.length === 0) return '';
  if (lower.length === 1) return `Skips ${lower[0]}.`;
  if (lower.length === 2) return `Skips ${lower[0]} and ${lower[1]}.`;
  const more = lower.length - 2;
  return `Skips ${lower[0]}, ${lower[1]} and ${more} more ${more === 1 ? 'food' : 'foods'} to avoid.`;
}

/**
 * Why a round of ideas didn't happen, in Bellie's plain words (Figma 29l). A failed round never counts toward the
 * day's 10, and the screen says so.
 */
export function ideasErrorMessage(code: ErrorCode): string {
  switch (code) {
    case 'OFFLINE':
    case 'NETWORK':
      return 'Check your connection and try again.';
    case 'AI_TIMEOUT':
      return 'That took longer than expected. Try again in a moment.';
    case 'RATE_LIMITED':
      return "Bellie's kitchen is closed till tomorrow.";
    case 'SERVICE_BUSY':
      return "Bellie's kitchen is taking a short break. Please try again later.";
    default:
      return 'Something went wrong. Try again in a moment.';
  }
}

/** Why a fridge scan did not give a list, in Bellie's plain words (Figma 29o). The old list stays as it was. */
export function fridgeErrorMessage(code: ErrorCode | 'EMPTY'): string {
  switch (code) {
    case 'OFFLINE':
    case 'NETWORK':
      return 'Check your connection and try again.';
    case 'AI_TIMEOUT':
      return 'That took longer than expected. Try again in a moment.';
    case 'RATE_LIMITED':
      return "That's enough fridge scans for today. Try again tomorrow.";
    case 'SERVICE_BUSY':
      return 'Bellie is taking a short break. Please try again later.';
    case 'EMPTY':
    case 'INPUT_REJECTED':
    case 'UPLOAD_TOO_LARGE':
      return 'Try again, with the fridge door open and good light.';
    default:
      return 'Something went wrong. Try again in a moment.';
  }
}
