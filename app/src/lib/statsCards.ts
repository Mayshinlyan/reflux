import { TRIGGER_GROUP_NAMES } from '@/constants/triggerLabels';
import type { TriggerCategory } from '@/types/analysis';

import { type HistorySummary, ratedMeals, summarize } from './historySummary';
import { addDays, localDayKey } from './localDay';
import { isLateMeal, minutesOfDay } from './mealTiming';
import { type Period, shiftPeriod } from './range';
import { symptomLabel, type TimelineEntry } from './timeline';

/**
 * The numbers behind History's "Your week", "What sat well" and "When it shows up" cards (Figma row 28), and the
 * comparison lines on Food. All counts of what was logged, never how bad it was: quick logs carry no severity.
 */

/** How many symptoms in a day make it a rough one. */
export const LOTS_OF_SYMPTOMS = 3;
/** A symptom logged this long after a meal (or linked to it) counts as coming after that meal. */
export const AFTER_MEAL_HOURS = 4;
/** A meal needs to show up this often before it is called out, so one odd day never decides anything. */
export const MIN_MEAL_TIMES = 2;
/** The most meals either list shows. */
export const MAX_MEAL_ROWS = 3;
/** A kind of food (spicy, fatty...) needs this many meals before it is called out, with symptoms after half of them. */
export const MIN_TRIGGER_MEALS = 3;

export type Unit = 'week' | 'month';

// ---------- days

/** Nothing logged, a day with no symptoms, 1 to 2 symptoms, or 3 or more. */
export type DayState = 'none' | 'calm' | 'some' | 'lots';
export type DayStat = { dayKey: string; state: DayState; symptoms: string[] };

const dayKeyOfEntry = (entry: TimelineEntry) => localDayKey(entry.at, entry.tz);

/**
 * One stat per day from the period's first day to its last, or to `todayKey` if that comes first (days still to
 * come have nothing to say). A day with any entry and no symptoms is `calm`: the state's name, shown to the
 * person as "no symptoms logged".
 */
export function dayStats(entries: readonly TimelineEntry[], period: Period, todayKey: string): DayStat[] {
  const logged = new Set<string>();
  const symptoms = new Map<string, Set<string>>();
  for (const entry of entries) {
    const day = dayKeyOfEntry(entry);
    logged.add(day);
    if (entry.kind !== 'symptom') continue;
    for (const item of entry.log.items) {
      if (!symptoms.has(day)) symptoms.set(day, new Set());
      symptoms.get(day)!.add(item.key);
    }
  }
  const last = period.endKey < todayKey ? period.endKey : todayKey;
  const days: DayStat[] = [];
  for (let key = period.startKey; key <= last; key = addDays(key, 1)) {
    const keys = [...(symptoms.get(key) ?? [])];
    const state: DayState = !logged.has(key)
      ? 'none'
      : keys.length === 0
        ? 'calm'
        : keys.length >= LOTS_OF_SYMPTOMS
          ? 'lots'
          : 'some';
    days.push({ dayKey: key, state, symptoms: keys.map(symptomLabel) });
  }
  return days;
}

export const calmDays = (days: readonly DayStat[]) => days.filter((day) => day.state === 'calm').length;

/**
 * "4 days without symptoms", "1 day without symptoms", "No days without symptoms". It counts symptoms logged,
 * never the verdicts of the meals eaten: a day with a caution meal and no symptoms is still one of these days.
 */
export function calmHeadline(days: readonly DayStat[]): string {
  const calm = calmDays(days);
  return calm === 0 ? 'No days without symptoms' : `${calm} ${calm === 1 ? 'day' : 'days'} without symptoms`;
}

/**
 * "1 more than last week" (also fewer, or the same). A period still going is compared with the same number of
 * days at the start of the last one, so a half-finished week isn't set against a whole one. Nothing when the
 * last period has no logged day to compare with.
 */
export function calmComparison(
  current: readonly DayStat[],
  previous: readonly DayStat[] | null,
  unit: Unit,
): string | undefined {
  if (!previous) return undefined;
  const before = previous.slice(0, current.length);
  if (!before.some((day) => day.state !== 'none')) return undefined;
  const diff = calmDays(current) - calmDays(before);
  if (diff === 0) return `Same as last ${unit}`;
  return `${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'} than last ${unit}`;
}

// ---------- meals

export type MealPattern = { name: string; times: number; withSymptoms: number };

const HOUR_MS = 60 * 60 * 1000;

/** True if a symptom was logged for this meal, or came within the window after it. */
function symptomsFollow(meal: Extract<TimelineEntry, { kind: 'food' }>, entries: readonly TimelineEntry[]) {
  const eaten = Date.parse(meal.at);
  return entries.some((entry) => {
    if (entry.kind !== 'symptom' || entry.log.items.length === 0) return false;
    if (entry.log.foodLogId === meal.id) return true;
    const gap = Date.parse(entry.at) - eaten;
    return gap >= 0 && gap <= AFTER_MEAL_HOURS * HOUR_MS;
  });
}

/**
 * Meals eaten at least `minTimes` (twice by default) in the period, split by whether symptoms were logged after them. A meal with no
 * symptoms after it only counts once the window has passed, since there may still be some on the way.
 */
export function mealPatterns(entries: readonly TimelineEntry[], now: Date, minTimes = MIN_MEAL_TIMES) {
  const groups = new Map<string, MealPattern>();
  for (const entry of entries) {
    if (entry.kind !== 'food') continue;
    const name = entry.log.mealName.trim();
    if (!name) continue;
    const followed = symptomsFollow(entry, entries);
    if (!followed && Date.parse(entry.at) + AFTER_MEAL_HOURS * HOUR_MS > now.getTime()) continue;
    const key = name.toLowerCase();
    const group = groups.get(key) ?? { name, times: 0, withSymptoms: 0 };
    group.times += 1;
    if (followed) group.withSymptoms += 1;
    groups.set(key, group);
  }
  const all = [...groups.values()];
  const sat = all
    .filter((meal) => meal.withSymptoms === 0 && meal.times >= minTimes)
    .sort((a, b) => b.times - a.times || a.name.localeCompare(b.name))
    .slice(0, MAX_MEAL_ROWS);
  const watch = all
    .filter((meal) => meal.withSymptoms >= minTimes)
    .sort((a, b) => b.withSymptoms / b.times - a.withSymptoms / a.times || b.times - a.times)
    .slice(0, MAX_MEAL_ROWS);
  return { sat, watch };
}

/**
 * The same idea by what the check found in the meals instead of the dish: "Spicy meals, symptoms after 3 of 4". It
 * works when no dish is eaten twice. A kind of food needs at least three meals, and symptoms after at least two of
 * them and after half or more, so a single rough evening never decides anything.
 */
export function triggerPatterns(entries: readonly TimelineEntry[], now: Date): MealPattern[] {
  const groups = new Map<TriggerCategory, MealPattern>();
  for (const entry of entries) {
    if (entry.kind !== 'food') continue;
    const categories = new Set(
      (entry.log.analysis?.items ?? []).flatMap((item) =>
        item.matchedTriggers.map((trigger) => trigger.category),
      ),
    );
    if (categories.size === 0) continue;
    const followed = symptomsFollow(entry, entries);
    if (!followed && Date.parse(entry.at) + AFTER_MEAL_HOURS * HOUR_MS > now.getTime()) continue;
    for (const category of categories) {
      const group = groups.get(category) ?? {
        name: TRIGGER_GROUP_NAMES[category],
        times: 0,
        withSymptoms: 0,
      };
      group.times += 1;
      if (followed) group.withSymptoms += 1;
      groups.set(category, group);
    }
  }
  return [...groups.values()]
    .filter(
      (group) =>
        group.times >= MIN_TRIGGER_MEALS &&
        group.withSymptoms >= MIN_MEAL_TIMES &&
        group.withSymptoms * 2 >= group.times,
    )
    .sort((a, b) => b.withSymptoms / b.times - a.withSymptoms / a.times || b.times - a.times)
    .slice(0, MAX_MEAL_ROWS);
}

// ---------- time of day

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
export const TIMES_OF_DAY: readonly { key: TimeOfDay; label: string }[] = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
  { key: 'night', label: 'Night' },
];

/** Morning is 5 am to noon, afternoon noon to 6 pm, evening 6 to 10 pm, and the rest is night. */
export function timeOfDay(iso: string, tz: string): TimeOfDay {
  const minutes = minutesOfDay(iso, tz);
  if (minutes >= 5 * 60 && minutes < 12 * 60) return 'morning';
  if (minutes >= 12 * 60 && minutes < 18 * 60) return 'afternoon';
  if (minutes >= 18 * 60 && minutes < 22 * 60) return 'evening';
  return 'night';
}

/** How many symptoms were logged in each part of the day, each one counted at its entry's time. */
export function symptomsByTime(entries: readonly TimelineEntry[]): Record<TimeOfDay, number> {
  const counts: Record<TimeOfDay, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const entry of entries) {
    if (entry.kind === 'symptom') counts[timeOfDay(entry.at, entry.tz)] += entry.log.items.length;
  }
  return counts;
}

const TIME_TITLES: Record<TimeOfDay, string> = {
  morning: 'Mostly mornings',
  afternoon: 'Mostly afternoons',
  evening: 'Mostly evenings',
  night: 'Mostly at night',
};

/** The card's title: where most symptoms fell, or that they spread out, or that there are none. */
export function whenTitle(counts: Record<TimeOfDay, number>): string {
  const ranked = TIMES_OF_DAY.map(({ key }) => ({ key, count: counts[key] })).sort(
    (a, b) => b.count - a.count,
  );
  if (ranked[0]!.count === 0) return 'When it shows up';
  if (ranked[0]!.count === ranked[1]!.count) return 'All through the day';
  return TIME_TITLES[ranked[0]!.key];
}

/** Meals eaten close to bedtime, and how many of those had symptoms after them. */
export function lateMeals(entries: readonly TimelineEntry[], bedtime: string, windowMinutes: number) {
  let late = 0;
  let withSymptoms = 0;
  for (const entry of entries) {
    if (entry.kind !== 'food' || !isLateMeal(entry.at, entry.tz, bedtime, windowMinutes)) continue;
    late += 1;
    if (symptomsFollow(entry, entries)) withSymptoms += 1;
  }
  return { late, withSymptoms };
}

// ---------- everything the cards need, in one go

export type StatsKind = 'week' | 'month' | 'all' | 'custom';

/** What History's stat cards show beyond the donut's own `HistorySummary`. */
export type PeriodStats = {
  /** Week and month have a "Your week" or "Your month" card and a last period to compare with. */
  unit: Unit | null;
  period: Period;
  todayKey: string;
  days: DayStat[];
  previousDays: DayStat[] | null;
  previousSummary: HistorySummary | null;
  patterns: ReturnType<typeof mealPatterns>;
  byTime: Record<TimeOfDay, number>;
  late: ReturnType<typeof lateMeals>;
  windowMinutes: number;
};

type BuildInput = {
  entries: readonly TimelineEntry[];
  /** The week or month before this one; null for all time and picked dates. */
  previousEntries: readonly TimelineEntry[] | null;
  kind: StatsKind;
  period: Period;
  todayKey: string;
  bedtime: string;
  windowMinutes: number;
  now: Date;
};

export function buildStats({
  entries,
  previousEntries,
  kind,
  period,
  todayKey,
  bedtime,
  windowMinutes,
  now,
}: BuildInput): PeriodStats {
  const unit: Unit | null = kind === 'week' || kind === 'month' ? kind : null;
  const previousPeriod = unit ? shiftPeriod(unit, period, -1) : null;
  return {
    unit,
    period,
    todayKey,
    days: unit ? dayStats(entries, period, todayKey) : [],
    previousDays:
      previousPeriod && previousEntries ? dayStats(previousEntries, previousPeriod, todayKey) : null,
    previousSummary: previousEntries ? summarize(previousEntries, dayKeyOfEntry) : null,
    patterns: mealPatterns(entries, now),
    byTime: symptomsByTime(entries),
    late: lateMeals(entries, bedtime, windowMinutes),
    windowMinutes,
  };
}

// ---------- lines under the numbers

/** "stress and poor sleep", "stress", or nothing: the lifestyle factors logged most (never one logged 0 times). */
export function oftenWith(summary: HistorySummary): string | undefined {
  const top = summary.tags.filter((tag) => tag.count > 0).slice(0, 2);
  if (top.length === 0) return undefined;
  return top.map((tag) => tag.label.toLowerCase()).join(' and ');
}

/** "heartburn and burping": the symptoms logged most, for the line under Food. */
export function mostlySymptoms(summary: HistorySummary): string | undefined {
  const top = summary.symptoms.filter((symptom) => symptom.count > 0).slice(0, 2);
  if (top.length === 0) return undefined;
  return top.map((symptom) => symptom.label.toLowerCase()).join(' and ');
}

/** The share of rated meals that were good, as a whole percent. Null with no rated meals. */
export function goodPercent(summary: HistorySummary): number | null {
  const rated = ratedMeals(summary);
  return rated === 0 ? null : Math.round((summary.verdicts.good / rated) * 100);
}

/** "50% good, up from 40% last week", also down or the same. Nothing unless both periods have rated meals. */
export function goodComparison(
  current: HistorySummary,
  previous: HistorySummary | null,
  unit: Unit,
): string | undefined {
  const now = goodPercent(current);
  const before = previous ? goodPercent(previous) : null;
  if (now === null || before === null) return undefined;
  if (now === before) return `${now}% good, same as last ${unit}`;
  return `${now}% good, ${now > before ? 'up' : 'down'} from ${before}% last ${unit}`;
}
