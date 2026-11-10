import { formatWindow } from './clock';

/** How long after a meal the check-in reminder can fire, in minutes (Figma 08b). */
export const REMINDER_OPTIONS: readonly number[] = [60, 120, 180];

/** What "Turn on" picks: about two hours after a meal. */
export const DEFAULT_REMINDER_MINUTES = 120;

/** Meals logged this many times prompt the one-time opt-in sheet (Figma 08c). */
export const REMINDER_PROMPT_AFTER_MEALS = 3;

/** No reminder lands in the 8 hours after bedtime, so it never wakes anyone or greets them at 3 AM. */
const QUIET_MINUTES = 8 * 60;
const DAY_MINUTES = 24 * 60;

/** The Settings value: "Off", or "2 hours". */
export function formatReminder(minutes: number | null): string {
  return minutes === null ? 'Off' : formatWindow(minutes);
}

/** A picker row: "2 hours after a meal". */
export function reminderOptionLabel(minutes: number): string {
  return `${formatWindow(minutes)} after a meal`;
}

/** When the reminder for a meal eaten at `eatenAt` should fire. */
export function checkInTime(eatenAt: Date, minutes: number): Date {
  return new Date(eatenAt.getTime() + minutes * 60_000);
}

/** True when `at` (local time) falls in the quiet hours that start at `bedtime` ("HH:MM", 24h). */
export function isQuietTime(at: Date, bedtime: string): boolean {
  const [hours, minutes] = bedtime.split(':').map(Number);
  const bed = hours * 60 + minutes;
  const now = at.getHours() * 60 + at.getMinutes();
  return (now - bed + DAY_MINUTES) % DAY_MINUTES < QUIET_MINUTES;
}

export const CHECK_IN_TITLE = 'How are you feeling?';

/** The Sunday evening notification that a week's report is ready (Figma 42f). */
export const REPORT_TITLE = 'Your week with Bellie';
export const REPORT_BODY = 'See what sat well and what to watch.';

/** "You had Spicy chicken tacos about 2 hours ago. Tap to check in." */
export function checkInBody(mealName: string, minutes: number): string {
  return `You had ${mealName} about ${formatWindow(minutes)} ago. Tap to check in.`;
}
