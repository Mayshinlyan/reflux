import type { ErrorCode } from '@/lib/errors';

/**
 * The line under the ideas sheet's choices, so you can see your "I don't eat" list is being respected (Figma 29b).
 * Empty when the list is empty. Names come in as saved; the first two are listed, the rest counted.
 */
export function skipsLine(names: readonly string[]): string {
  const lower = names.map((name) => name.toLowerCase());
  if (lower.length === 0) return '';
  if (lower.length === 1) return `Skips ${lower[0]}.`;
  if (lower.length === 2) return `Skips ${lower[0]} and ${lower[1]}.`;
  const more = lower.length - 2;
  return `Skips ${lower[0]}, ${lower[1]} and ${more} more ${more === 1 ? 'food' : 'foods'} you don't eat.`;
}

/** Why an ingredient edit didn't happen, in Bellie's plain words (Figma 31h). The recipe is always as it was. */
export function editErrorMessage(code: ErrorCode): string {
  switch (code) {
    case 'RATE_LIMITED':
      return 'Bellie needs a rest from edits today. Try again tomorrow.';
    case 'OFFLINE':
    case 'NETWORK':
      return "Couldn't update. Check your connection. Your recipe is as it was.";
    default:
      return "Couldn't update. Your recipe is as it was.";
  }
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
