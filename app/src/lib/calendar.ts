import { addDays } from './localDay';
import { MONTH_NAMES, type Period } from './range';

/** One calendar month, 0-based like `Date`: October 2026 is `{ year: 2026, month: 9 }`. */
export type CalendarMonth = { year: number; month: number; key: string; title: string };

const pad = (n: number) => String(n).padStart(2, '0');

const monthOf = (year: number, month: number): CalendarMonth => ({
  year,
  month,
  key: `${year}-${pad(month + 1)}`,
  title: `${MONTH_NAMES[month]} ${year}`,
});

/** The months from the one holding `startKey` to the one holding `endKey`, oldest first. */
export function monthsBetween(startKey: string, endKey: string): CalendarMonth[] {
  let year = Number(startKey.slice(0, 4));
  let month = Number(startKey.slice(5, 7)) - 1;
  const lastYear = Number(endKey.slice(0, 4));
  const lastMonth = Number(endKey.slice(5, 7)) - 1;
  const months: CalendarMonth[] = [];
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push(monthOf(year, month));
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }
  return months;
}

/** The month as weeks of day keys, Sunday first; days outside the month are null. */
export function monthGrid({ year, month }: Pick<CalendarMonth, 'year' | 'month'>): (string | null)[][] {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= days; day++) cells.push(`${year}-${pad(month + 1)}-${pad(day)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

/** The days chosen so far: nothing, a start only, or a start and an end. */
export type Selection = { start: string | null; end: string | null };

export const EMPTY_SELECTION: Selection = { start: null, end: null };

/**
 * What a tap on `dayKey` does. The first tap sets the start; the next sets the end, or, when it is
 * earlier than the start, makes the two the ends of the range. Tapping again once both are set starts over.
 */
export function nextSelection(selection: Selection, dayKey: string): Selection {
  if (selection.start === null || selection.end !== null) return { start: dayKey, end: null };
  if (dayKey < selection.start) return { start: dayKey, end: selection.start };
  return { start: selection.start, end: dayKey };
}

/** The chosen days as a period; a start with no end is that one day. Null when nothing is chosen. */
export function selectionPeriod(selection: Selection): Period | null {
  if (selection.start === null) return null;
  return { startKey: selection.start, endKey: selection.end ?? selection.start };
}

/** Whether `dayKey` is inside the chosen days, ends included. */
export function inSelection(selection: Selection, dayKey: string): boolean {
  const period = selectionPeriod(selection);
  return period !== null && dayKey >= period.startKey && dayKey <= period.endKey;
}

/** The day keys of a period, for adding up per-day counts. */
export function daysOf(period: Period): string[] {
  const days: string[] = [];
  for (let day = period.startKey; day <= period.endKey; day = addDays(day, 1)) days.push(day);
  return days;
}
