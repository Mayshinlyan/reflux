/**
 * Coins reward checking in, never what was logged: every saved entry earns the same amount,
 * whatever the meal's verdict or how bad the symptoms were. Like the pet, the balance is
 * derived from the logs each time it is read, so edits and deletes stay consistent.
 */

export const COINS_PER_LOG = 1;

export function coinsForLogs(loggedEntries: number): number {
  return Math.max(0, loggedEntries) * COINS_PER_LOG;
}

/**
 * Coins earned since the balance was last shown, for the "+N" pop. Zero on the first read
 * (opening the app isn't an earning moment) and when the balance fell (an entry was deleted).
 */
export function coinGain(previous: number | null, current: number): number {
  if (previous === null) return 0;
  return Math.max(0, current - previous);
}
