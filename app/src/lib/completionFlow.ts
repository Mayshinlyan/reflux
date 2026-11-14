import { type BellieStage, stageForDays, stageIndex } from './bellieStage';
import type { CheckInSummary } from './streak';

/** What was just logged: a meal, symptoms (with any lifestyle), or a medication dose. */
export type LogKind = 'meal' | 'symptoms' | 'dose';

/** The days with a gift page: the hat on day 3 and the first report on day 7. The other items unlock quietly (see bellieItems). */
export const GIFT_DAYS = [3, 7] as const;
export type GiftDay = (typeof GIFT_DAYS)[number];

/** The first pattern needs about a week of check-ins. */
export const PATTERN_DAYS = 7;

export type Step =
  | { screen: 'completion' }
  | { screen: 'streak' }
  | { screen: 'grew'; stage: BellieStage }
  | { screen: 'commit'; mode: 'goal' | 'progress' }
  | { screen: 'gift'; day: GiftDay };

type Memory = { commitGoal: number | null; giftsSeen: number[]; stageSeen: BellieStage };

/**
 * Which screens follow a saved log (Figma G5): the completion always; the rest only on the first check-in of the
 * day, so a second log that day is just the completion. When the check-in days reach a new growth stage, Bellie grows
 * (the "grew" page, after the streak). Goal on days 1 and 2 until one is picked, progress on day 3, a gift on day 3
 * (the hat) and day 7 (the first report), each once.
 */
export function planCompletion(summary: CheckInSummary, memory: Memory): Step[] {
  const steps: Step[] = [{ screen: 'completion' }];
  if (summary.todayCount !== 1) return steps;

  steps.push({ screen: 'streak' });
  const day = summary.checkInDays;
  const reached = stageForDays(day);
  if (stageIndex(reached) > stageIndex(memory.stageSeen)) steps.push({ screen: 'grew', stage: reached });
  if ((day === 1 || day === 2) && memory.commitGoal === null) steps.push({ screen: 'commit', mode: 'goal' });
  if (day === 3) steps.push({ screen: 'commit', mode: 'progress' });
  // The first gift not yet opened that has been reached, so a milestone day with no check-in is not lost.
  const gift = GIFT_DAYS.find((giftDay) => giftDay <= day && !memory.giftsSeen.includes(giftDay));
  if (gift !== undefined) steps.push({ screen: 'gift', day: gift });
  return steps;
}

export function titleFor(kind: LogKind): string {
  return kind === 'meal' ? 'Meal logged' : kind === 'symptoms' ? 'Symptoms logged' : 'Dose logged';
}

export function subtitleFor(kind: LogKind, note?: string): string {
  if (kind === 'meal') return 'Nice, that is in your day.';
  if (kind === 'symptoms') return 'Thanks for telling Bellie.';
  return note ?? 'Nice, that is in your day.';
}

export function statLineFor(kind: LogKind, summary: CheckInSummary): string {
  const n =
    kind === 'meal'
      ? summary.todayByKind.meals
      : kind === 'symptoms'
        ? summary.todayByKind.symptoms
        : summary.todayByKind.doses;
  if (kind === 'meal') return `${n} ${n === 1 ? 'meal' : 'meals'} today`;
  if (kind === 'symptoms') return `${n} ${n === 1 ? 'check-in' : 'check-ins'} today`;
  return `${n} ${n === 1 ? 'dose' : 'doses'} today`;
}

/** "4 days checking in", "First check-in", or the welcome back line. */
export function streakHeadline(summary: CheckInSummary): {
  big: string | null;
  title: string;
  subtitle: string;
} {
  if (summary.returningAfterGap) {
    return { big: null, title: 'Welcome back', subtitle: 'Bellie saved your spot.' };
  }
  if (summary.streak <= 1) {
    return { big: '1', title: 'First check-in', subtitle: 'Bellie starts counting with you.' };
  }
  return { big: String(summary.streak), title: 'days checking in', subtitle: 'Bellie’s sprout grew a leaf.' };
}
