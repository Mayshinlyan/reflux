import { addDays } from './localDay';
import { weekOf } from './week';

/** What History shows at once: a Sunday-to-Saturday week or a calendar month. */
export type RangeMode = 'week' | 'month';

/** A span of local days, both ends included, as "YYYY-MM-DD" keys. */
export type Period = { startKey: string; endKey: string };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const parts = (dayKey: string) => {
  const [y, m, d] = dayKey.split('-').map(Number);
  return { year: y ?? 1970, month: (m ?? 1) - 1, date: d ?? 1 };
};

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (year: number, month: number, date: number) => `${year}-${pad(month + 1)}-${pad(date)}`;

/** The week or month that contains `dayKey`. */
export function periodOf(mode: RangeMode, dayKey: string): Period {
  if (mode === 'week') {
    const days = weekOf(dayKey);
    return { startKey: days[0]!.key, endKey: days[6]!.key };
  }
  const { year, month } = parts(dayKey);
  // Day 0 of the next month is the last day of this one.
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return { startKey: keyOf(year, month, 1), endKey: keyOf(year, month, last) };
}

/** The period `steps` weeks or months after `period` (negative for earlier). */
export function shiftPeriod(mode: RangeMode, period: Period, steps: number): Period {
  if (mode === 'week') return periodOf('week', addDays(period.startKey, steps * 7));
  const { year, month } = parts(period.startKey);
  const target = new Date(Date.UTC(year, month + steps, 1));
  return periodOf('month', keyOf(target.getUTCFullYear(), target.getUTCMonth(), 1));
}

/**
 * The text on the range pill: "Oct 4 – 10", "Sep 27 – Oct 3" or "October". The year is added only when the
 * period isn't in the same year as `todayKey`.
 */
export function periodLabel(mode: RangeMode, period: Period, todayKey: string): string {
  if (mode === 'month') {
    const start = parts(period.startKey);
    const showYear =
      start.year !== parts(todayKey).year || parts(period.endKey).year !== parts(todayKey).year;
    return `${MONTH_NAMES[start.month]}${showYear ? ` ${start.year}` : ''}`;
  }
  return spanLabel(period, todayKey);
}

/**
 * Any span of days as "Sep 27 – Oct 3" (or "Oct 4 – 10" inside one month), for weeks, all time and a range
 * picked on the calendar. The year is added when the span isn't in the same year as `todayKey`.
 */
export function spanLabel(period: Period, todayKey: string): string {
  const start = parts(period.startKey);
  const end = parts(period.endKey);
  const showYear = start.year !== parts(todayKey).year || end.year !== parts(todayKey).year;
  const from = `${MONTHS[start.month]} ${start.date}`;
  const oneDay = period.startKey === period.endKey;
  const to =
    end.month === start.month && end.year === start.year ? `${end.date}` : `${MONTHS[end.month]} ${end.date}`;
  const year = showYear
    ? start.year === end.year
      ? `, ${start.year}`
      : `, ${start.year} – ${end.year}`
    : '';
  return oneDay ? `${from}${year}` : `${from} – ${to}${year}`;
}

/** Whether the period reaches today, so there is nothing later to step forward to. */
export const isCurrent = (period: Period, todayKey: string) => period.endKey >= todayKey;

export const samePeriod = (a: Period, b: Period) => a.startKey === b.startKey && a.endKey === b.endKey;

/** Whether a day key falls inside the period. Keys sort as text. */
export const inPeriod = (period: Period, dayKey: string) =>
  dayKey >= period.startKey && dayKey <= period.endKey;

/**
 * An ISO range wide enough to load every entry of the period whatever zone it was logged in: from a day
 * before the first day to two days after the last (the end is exclusive). Callers then keep entries whose
 * own local day is in the period.
 */
export function loadWindow(period: Period): { from: string; to: string } {
  const start = parts(addDays(period.startKey, -1));
  const end = parts(addDays(period.endKey, 2));
  return {
    from: new Date(start.year, start.month, start.date).toISOString(),
    to: new Date(end.year, end.month, end.date).toISOString(),
  };
}
