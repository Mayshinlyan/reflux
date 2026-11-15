import { type Period, periodOf, shiftPeriod } from './range';
import {
  MAX_MEAL_ROWS,
  MIN_MEAL_TIMES,
  type MealPattern,
  mealPatterns,
  symptomsByTime,
  TIMES_OF_DAY,
  type TimeOfDay,
  triggerPatterns,
} from './statsCards';
import type { TimelineEntry } from './timeline';

/**
 * "Your week with Bellie" (Figma row 42): what to watch, what sat well, when symptoms showed up. Counts of what was
 * logged only, never a diagnosis, and every line is worded as "may".
 */

/** Until this many meals are logged there is too little to say, and Bellie says how many more it takes. */
export const REPORT_MIN_MEALS = 5;

/** The newest Sunday-to-Saturday week that has ended: the one a new report is about. */
export const lastFullWeek = (todayKey: string): Period => shiftPeriod('week', periodOf('week', todayKey), -1);

export type WeeklyReport = {
  /** Foods and kinds of food that symptoms often followed, worst first. */
  watch: MealPattern[];
  /** Foods eaten more than once with no symptoms after. */
  sat: MealPattern[];
  /** Where most of the week's symptoms fell, in a sentence, or null when none were logged. */
  whenText: string | null;
  mealsLogged: number;
  /** How many more meals it takes before the report can say anything; 0 once there are enough. */
  mealsNeeded: number;
  /** True when there is something to show: a food to call out, or symptoms to place in the day. */
  hasContent: boolean;
};

const WHEN_TEXT: Record<TimeOfDay, string> = {
  morning: 'Mostly in the morning.',
  afternoon: 'Mostly in the afternoon.',
  evening: 'Mostly in the evening, after 6pm.',
  night: 'Mostly at night.',
};

/** Where most symptoms fell, or that they spread out; null when there were none. */
export function whenSentence(counts: Record<TimeOfDay, number>): string | null {
  const ranked = TIMES_OF_DAY.map(({ key }) => ({ key, count: counts[key] })).sort(
    (a, b) => b.count - a.count,
  );
  if (ranked[0]!.count === 0) return null;
  if (ranked[0]!.count === ranked[1]!.count) return 'All through the day.';
  return WHEN_TEXT[ranked[0]!.key];
}

/**
 * `entries` is everything logged up to the end of the week, so a food shows up once it has been eaten and checked at
 * any time, not only inside one week; one meal is enough. `weekEntries` is just the week, for when the symptoms came.
 */
export function buildWeeklyReport(input: {
  entries: readonly TimelineEntry[];
  weekEntries: readonly TimelineEntry[];
  now: Date;
}): WeeklyReport {
  const mealsLogged = input.entries.filter((entry) => entry.kind === 'food').length;
  // Once the first report is unlocked one meal is enough to list; before that it still needs a repeat.
  const dishes = mealPatterns(input.entries, input.now, mealsLogged >= REPORT_MIN_MEALS ? 1 : MIN_MEAL_TIMES);
  const watch = [...dishes.watch, ...triggerPatterns(input.entries, input.now)]
    .sort((a, b) => b.withSymptoms / b.times - a.withSymptoms / a.times || b.times - a.times)
    .slice(0, MAX_MEAL_ROWS);
  const sat = dishes.sat;
  const whenText = whenSentence(symptomsByTime(input.weekEntries));
  return {
    watch,
    sat,
    whenText,
    mealsLogged,
    mealsNeeded: Math.max(0, REPORT_MIN_MEALS - mealsLogged),
    hasContent: watch.length + sat.length > 0 || whenText !== null,
  };
}

/** "2 of 3" for a food symptoms followed, "3 times" (or "Once") for one that sat well. */
export const watchCount = (pattern: MealPattern) => `${pattern.withSymptoms} of ${pattern.times}`;
export const satCount = (pattern: MealPattern) => (pattern.times === 1 ? 'Once' : `${pattern.times} times`);
