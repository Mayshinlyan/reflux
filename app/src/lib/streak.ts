import type { CheckInStamp } from '@/db/repositories/checkIns';

import { addDays, localDayKey } from './localDay';

/** What the completion flow needs to know about someone's check-ins. Counts logging, never how it went. */
export type CheckInSummary = {
  /** Check-ins made today, this one included. */
  todayCount: number;
  /** Different days with at least one check-in, today included. Gaps never take this away. */
  checkInDays: number;
  /** Days in a row ending today. */
  streak: number;
  /** First check-in today after at least a day without one (and not the very first ever). */
  returningAfterGap: boolean;
  /** Days of the current Monday to Sunday week with a check-in. */
  weekDays: string[];
  /** All check-ins ever, by kind. */
  counts: { meals: number; symptoms: number; doses: number };
  /** Today's check-ins, by kind. */
  todayByKind: { meals: number; symptoms: number; doses: number };
};

/** "YYYY-MM-DD" of the Monday of the week `dayKey` is in. */
export function mondayOf(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const weekday = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay(); // 0 = Sunday
  return addDays(dayKey, -((weekday + 6) % 7));
}

export function summarizeCheckIns(stamps: CheckInStamp[], now: Date, tz: string): CheckInSummary {
  const today = localDayKey(now.toISOString(), tz);
  const perDay = new Map<string, number>();
  const counts = { meals: 0, symptoms: 0, doses: 0 };
  const todayByKind = { meals: 0, symptoms: 0, doses: 0 };
  for (const stamp of stamps) {
    const day = localDayKey(stamp.at, tz);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    const key = stamp.kind === 'meal' ? 'meals' : stamp.kind === 'symptoms' ? 'symptoms' : 'doses';
    counts[key] += 1;
    if (day === today) todayByKind[key] += 1;
  }

  let streak = 0;
  for (let day = today; perDay.has(day); day = addDays(day, -1)) streak += 1;

  const todayCount = perDay.get(today) ?? 0;
  const checkInDays = perDay.size;
  const monday = mondayOf(today);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((day) => perDay.has(day));
  const returningAfterGap = todayCount > 0 && streak === 1 && checkInDays > 1;

  return { todayCount, checkInDays, streak, returningAfterGap, weekDays, counts, todayByKind };
}
