/**
 * Back-logging: the time a meal was actually eaten, shown the way people say it ("yesterday, 8:15 AM"). All
 * of it is local device time; the diary stores the resulting instant as UTC alongside the zone it was logged in.
 */

/** How far back a meal can be logged: today and the six days before it. */
export const MEAL_DAYS_BACK = 6;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Local midnight `dayOffset` days before `now`. Built from parts so DST can't shift the day. */
function dayBefore(now: Date, dayOffset: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset);
}

/** The earliest time the picker allows: midnight, six days ago. */
export function earliestMealTime(now: Date): Date {
  return dayBefore(now, MEAL_DAYS_BACK);
}

/** `day`'s calendar date with `time`'s hour and minute (for pickers that choose the two separately). */
export function withTimeOf(day: Date, time: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes());
}

/** "Today", "Yesterday", then "Mon 28 Sep". */
export function dayChoiceLabel(dayOffset: number, now: Date): string {
  if (dayOffset === 0) return 'Today';
  if (dayOffset === 1) return 'Yesterday';
  const day = dayBefore(now, dayOffset);
  return `${WEEKDAYS[day.getDay()]} ${day.getDate()} ${MONTHS[day.getMonth()]}`;
}

/** "8:15 AM" for a local Date. */
export function formatClockTime(at: Date): string {
  const hour24 = at.getHours();
  const minutes = String(at.getMinutes()).padStart(2, '0');
  return `${hour24 % 12 === 0 ? 12 : hour24 % 12}:${minutes} ${hour24 >= 12 ? 'PM' : 'AM'}`;
}

/** "Now" when no time was chosen, else "Today, 8:15 AM" / "Yesterday, 8:15 AM" / "Mon 28 Sep, 8:15 AM". */
export function formatMealTime(at: Date | null, now: Date): string {
  if (!at) return 'Now';
  const days = Math.round((dayBefore(now, 0).getTime() - dayBefore(at, 0).getTime()) / 86_400_000);
  return `${dayChoiceLabel(Math.max(days, 0), now)}, ${formatClockTime(at)}`;
}

/**
 * Noon on the local day `dayKey` ("YYYY-MM-DD"), for logging something on an earlier day without an exact
 * time. Null means "just use now": for today, a future day, a malformed key, or a day further back than
 * the pickers allow.
 */
export function dayToLoggedAt(dayKey: string, now: Date): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return null;
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const day = new Date(year, month - 1, date);
  if (day.getMonth() !== month - 1) return null; // e.g. 2026-02-31
  if (day.getTime() >= dayBefore(now, 0).getTime()) return null;
  if (day.getTime() < earliestMealTime(now).getTime()) return null;
  return new Date(year, month - 1, date, 12, 0);
}
