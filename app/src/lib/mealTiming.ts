/**
 * "Late meal" is computed when read, never stored, so changing bedtime updates every
 * past meal. A meal is late when it was eaten within the window (3 hours by default) of
 * bedtime, on either side of it, using the clock time where the meal was logged.
 */

const MINUTES_PER_DAY = 24 * 60;

const clockFormatters = new Map<string, Intl.DateTimeFormat>();

function clockFormatter(tz: string): Intl.DateTimeFormat {
  let formatter = clockFormatters.get(tz);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    clockFormatters.set(tz, formatter);
  }
  return formatter;
}

/** Minutes since local midnight for `iso` in `tz`. Unknown zones fall back to UTC. */
export function minutesOfDay(iso: string, tz: string): number {
  const date = new Date(iso);
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = clockFormatter(tz).formatToParts(date);
  } catch {
    parts = clockFormatter('UTC').formatToParts(date);
  }
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return (get('hour') % 24) * 60 + get('minute');
}

/** "22:30" -> 1350. Returns null for anything that isn't HH:MM. */
function bedtimeMinutes(bedtime: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(bedtime);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function isLateMeal(loggedAt: string, tz: string, bedtime: string, windowMinutes: number): boolean {
  const bed = bedtimeMinutes(bedtime);
  if (bed === null) return false;
  const gap = Math.abs(minutesOfDay(loggedAt, tz) - bed);
  // The clock wraps at midnight, so take the shorter way round.
  return Math.min(gap, MINUTES_PER_DAY - gap) <= windowMinutes;
}

/**
 * How many minutes before bedtime a meal was eaten, going the shorter way round the clock: positive before
 * bed, negative after it. Null when bedtime isn't a valid time.
 */
export function minutesBeforeBed(loggedAt: string, tz: string, bedtime: string): number | null {
  const bed = bedtimeMinutes(bedtime);
  if (bed === null) return null;
  const gap = bed - minutesOfDay(loggedAt, tz);
  return (
    ((((gap + MINUTES_PER_DAY / 2) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY) -
    MINUTES_PER_DAY / 2
  );
}
