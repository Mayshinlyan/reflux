/**
 * Clock times are stored as 24-hour "HH:MM" strings (the bedtime setting) and shown the
 * way people read them on a phone, e.g. "22:30" -> "10:30 PM".
 */

/** "22:30" -> "10:30 PM". Anything that isn't a valid HH:MM is returned unchanged. */
export function formatClock(hhmm: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) return hhmm;
  const hours = Number(match[1]);
  const minutes = match[2];
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
}

const HALF_HOUR = 30;
const FIRST_BEDTIME_MINUTES = 20 * 60; // 8:00 PM
const LAST_BEDTIME_MINUTES = 26 * 60; // 2:00 AM the next morning

/** Bedtimes offered in Settings: 8:00 PM to 2:00 AM in half-hour steps, as "HH:MM". */
export const BEDTIME_OPTIONS: readonly string[] = (() => {
  const options: string[] = [];
  for (let minutes = FIRST_BEDTIME_MINUTES; minutes <= LAST_BEDTIME_MINUTES; minutes += HALF_HOUR) {
    const wrapped = minutes % (24 * 60);
    const hours = String(Math.floor(wrapped / 60)).padStart(2, '0');
    const mins = String(wrapped % 60).padStart(2, '0');
    options.push(`${hours}:${mins}`);
  }
  return options;
})();
