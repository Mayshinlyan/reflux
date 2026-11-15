/**
 * Meter readings are decibels, 0 at the loudest and about -160 for silence. Speech sits roughly between -50 and
 * -10, so that range becomes the wave's 0 to 1; anything quieter than -55 is a flat line.
 */
const QUIET_DB = -55;

export function levelFromDb(db: number | undefined): number {
  if (db === undefined || !Number.isFinite(db)) return 0;
  return Math.min(1, Math.max(0, (db - QUIET_DB) / -QUIET_DB));
}
