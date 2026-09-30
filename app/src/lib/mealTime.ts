/**
 * Back-logging: the time a meal was actually eaten, picked as a day offset plus a 12-hour clock so it
 * reads the way people say it ("yesterday, 8:15 AM"). All of it is local device time; the diary stores
 * the resulting instant as UTC alongside the zone it was logged in.
 */

/** Today and the six days before it. */
export const MEAL_DAY_CHOICES = 7;
export const MINUTE_STEP = 5;

export type MealClock = { dayOffset: number; hour12: number; minute: number; pm: boolean };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Midnight-anchored local date `dayOffset` days before `now`. Built from parts so DST can't shift the day. */
function dayBefore(now: Date, dayOffset: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset);
}

/** "Today", "Yesterday", then "Mon 28 Sep". */
export function dayChoiceLabel(dayOffset: number, now: Date): string {
  if (dayOffset === 0) return 'Today';
  if (dayOffset === 1) return 'Yesterday';
  const day = dayBefore(now, dayOffset);
  return `${WEEKDAYS[day.getDay()]} ${day.getDate()} ${MONTHS[day.getMonth()]}`;
}

/** The instant a day offset + 12-hour clock names, in the device's local time. */
export function composeMealTime(now: Date, { dayOffset, hour12, minute, pm }: MealClock): Date {
  const day = dayBefore(now, dayOffset);
  const hour24 = (hour12 % 12) + (pm ? 12 : 0);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour24, minute);
}

/** The picker's starting point for `at`: the same moment, with the minute rounded down to a step. */
export function clockFromDate(at: Date, now: Date): MealClock {
  const hour24 = at.getHours();
  const days = Math.round(
    (dayBefore(now, 0).getTime() - new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime()) /
      86_400_000,
  );
  return {
    dayOffset: Math.min(Math.max(days, 0), MEAL_DAY_CHOICES - 1),
    hour12: hour24 % 12 === 0 ? 12 : hour24 % 12,
    minute: at.getMinutes() - (at.getMinutes() % MINUTE_STEP),
    pm: hour24 >= 12,
  };
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
  const days = Math.round(
    (dayBefore(now, 0).getTime() - new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime()) /
      86_400_000,
  );
  return `${dayChoiceLabel(Math.max(days, 0), now)}, ${formatClockTime(at)}`;
}
