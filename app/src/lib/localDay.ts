import { currentTimeZone } from './time';

/**
 * Local-day helpers. Entries store a UTC instant plus the IANA zone they were logged
 * in, so "which day was this?" is answered in that zone — correct across travel and
 * DST, and stable if the phone's zone changes later.
 */

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();

function dayKeyFormatter(tz: string): Intl.DateTimeFormat {
  let formatter = dayKeyFormatters.get(tz);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dayKeyFormatters.set(tz, formatter);
  }
  return formatter;
}

/** "YYYY-MM-DD" for the calendar day `iso` falls on in `tz`. Unknown zones fall back to UTC. */
export function localDayKey(iso: string, tz: string): string {
  const date = new Date(iso);
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = dayKeyFormatter(tz).formatToParts(date);
  } catch {
    parts = dayKeyFormatter('UTC').formatToParts(date);
  }
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Calendar arithmetic on a day key (no clocks involved, so DST can't shift it). */
export function addDays(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "Today", "Yesterday", or e.g. "Mon, 21 Sep". */
export function dayLabel(dayKey: string, now: Date = new Date(), tz: string = currentTimeZone()): string {
  const today = localDayKey(now.toISOString(), tz);
  if (dayKey === today) return 'Today';
  if (dayKey === addDays(today, -1)) return 'Yesterday';
  const [y, m, d] = dayKey.split('-').map(Number);
  const sameYear = y === Number(today.slice(0, 4));
  return cachedFormatter(sameYear ? 'dayThisYear' : 'dayOtherYear', 'UTC', () => ({
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })).format(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12)));
}

/** Clock time as it was where the entry was logged, e.g. "8:20 PM". */
export function formatTime(iso: string, tz: string): string {
  const timeOptions = (): Intl.DateTimeFormatOptions => ({ hour: 'numeric', minute: '2-digit' });
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = cachedFormatter('time', tz, timeOptions);
  } catch {
    formatter = cachedFormatter('time', 'UTC', timeOptions);
  }
  return formatter.format(new Date(iso));
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

/** Building an Intl.DateTimeFormat is slow on Hermes; History formats hundreds of times per load. */
function cachedFormatter(
  kind: string,
  tz: string,
  options: () => Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${kind}|${tz}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(undefined, { ...options(), timeZone: tz });
    formatterCache.set(key, formatter);
  }
  return formatter;
}
