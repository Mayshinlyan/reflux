import type { PlanSlot } from '@/constants/mealPlan';
import type { StoredMeal } from '@/db/repositories/mealPlans';

import { addDays } from './localDay';
import { symptomLabel } from './timeline';

/** What the rules need to know of a diary meal. `createdAt` is when it was saved, `loggedAt` when it was eaten. */
export type EatenMeal = { createdAt: string; loggedAt: string };
/** What the rules need to know of a symptom log. A log with no symptoms is lifestyle-only and does not count. */
export type SymptomEvent = { loggedAt: string; items: readonly { key: string }[] };

/** Hours a symptom can follow a meal and still be offered as "felt off after". */
export const FELT_OFF_HOURS = 4;
/** A meal after this hour is no longer "next": breakfast until 11, lunch until 4 pm, dinner all day. */
const SLOT_ENDS: Record<PlanSlot, number> = { breakfast: 11, lunch: 16, dinner: 24 };

const SLOT_ORDER: Record<PlanSlot, number> = { breakfast: 0, lunch: 1, dinner: 2 };

const time = (iso: string) => Date.parse(iso);

/** A diary meal counts as the planned one only if it was eaten within this many hours of the "Log it" tap. */
const MATCH_HOURS = 3;

/**
 * The diary meal that "Log it" led to: the first one saved after it was tapped and eaten within a few hours of it.
 * Null when "Log it" was never tapped or nothing fitting was saved (they backed out), in which case the meal is still
 * waiting to be logged. A meal in `taken` already belongs to another planned meal and is passed over.
 */
export function loggedMealFor(
  meal: StoredMeal,
  eaten: readonly EatenMeal[],
  taken?: ReadonlySet<EatenMeal>,
): EatenMeal | null {
  if (!meal.loggedAt) return null;
  const tapped = time(meal.loggedAt);
  const reach = MATCH_HOURS * 3_600_000;
  let first: EatenMeal | null = null;
  for (const item of eaten) {
    if (taken?.has(item) || time(item.createdAt) < tapped) continue;
    if (Math.abs(time(item.loggedAt) - tapped) > reach) continue;
    if (!first || time(item.createdAt) < time(first.createdAt)) first = item;
  }
  return first;
}

/**
 * The meal Today offers: the first of today's planned meals that is not skipped, not logged, and whose part of the
 * day has not passed. Null when there is none, so the card goes.
 */
export function nextPlannedMeal(
  meals: readonly StoredMeal[],
  today: string,
  now: Date,
  eaten: readonly EatenMeal[],
): StoredMeal | null {
  const hour = now.getHours() + now.getMinutes() / 60;
  const waiting = meals.filter(
    (meal) =>
      meal.day === today && !meal.skipped && hour < SLOT_ENDS[meal.slot] && !loggedMealFor(meal, eaten),
  );
  waiting.sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
  return waiting[0] ?? null;
}

const inOrder = (a: StoredMeal, b: StoredMeal) =>
  a.day === b.day ? SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot] : a.day < b.day ? -1 : 1;

export type SwapOffer = {
  /** The planned meal that was eaten. */
  meal: StoredMeal;
  /** What was logged after it, "heartburn". */
  symptom: string;
  /** How long after the meal, "two hours". */
  after: string;
  /** The meal that could be swapped: the next one of the same kind still to come. */
  next: StoredMeal;
};

const WORDS = ['an hour', 'two hours', 'three hours', 'four hours'];

/** "30 minutes", "an hour", "two hours": how long after a meal a symptom was logged. */
export function afterPhrase(minutes: number): string {
  if (minutes < 60)
    return `${Math.max(1, Math.round(minutes))} ${Math.round(minutes) === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.round(minutes / 60);
  return WORDS[Math.min(hours, WORDS.length) - 1] ?? `${hours} hours`;
}

/**
 * Offers to swap a later meal, only after a planned meal that was really logged was followed by a symptom within a
 * few hours. Asks once per meal (`offeredFor`). Null when there is no such meal, or nothing left to swap.
 */
export function swapOffer(
  meals: readonly StoredMeal[],
  today: string,
  now: Date,
  eaten: readonly EatenMeal[],
  symptoms: readonly SymptomEvent[],
  offeredFor: number | null,
): SwapOffer | null {
  const yesterday = addDays(today, -1);
  // Only the last meal offered is remembered, so it and every meal before it count as already asked.
  const last = meals.find((meal) => meal.id === offeredFor);
  const candidates = meals
    .filter((meal) => (meal.day === today || meal.day === yesterday) && (!last || inOrder(meal, last) > 0))
    .sort((a, b) => inOrder(b, a));
  for (const meal of candidates) {
    const log = loggedMealFor(meal, eaten);
    if (!log) continue;
    const ate = time(log.loggedAt);
    const felt = symptoms
      .filter((event) => event.items.length > 0)
      .filter((event) => {
        const at = time(event.loggedAt);
        return at > ate && at <= ate + FELT_OFF_HOURS * 3_600_000 && at <= now.getTime();
      })
      .sort((a, b) => time(a.loggedAt) - time(b.loggedAt))[0];
    const first = felt?.items[0];
    if (!felt || !first) continue;
    const next = meals
      .filter((other) => !other.skipped && inOrder(meal, other) < 0 && !loggedMealFor(other, eaten))
      .sort((a, b) => (a.slot === meal.slot ? 0 : 1) - (b.slot === meal.slot ? 0 : 1) || inOrder(a, b))[0];
    if (!next) continue;
    return {
      meal,
      symptom: symptomLabel(first.key as Parameters<typeof symptomLabel>[0]).toLowerCase(),
      after: afterPhrase((time(felt.loggedAt) - ate) / 60_000),
      next,
    };
  }
  return null;
}

/**
 * How last week went: of the planned meals that were logged, how many were followed by no symptom within a few hours.
 * `wellTitles` are the dishes of the ones that sat well, which "Repeat what worked" keeps.
 */
export function weekResult(
  meals: readonly StoredMeal[],
  eaten: readonly EatenMeal[],
  symptoms: readonly SymptomEvent[],
): { logged: number; well: number; wellTitles: string[] } {
  let logged = 0;
  let well = 0;
  const wellTitles: string[] = [];
  // Each diary meal answers for one planned meal only.
  const taken = new Set<EatenMeal>();
  for (const meal of meals) {
    const log = loggedMealFor(meal, eaten, taken);
    if (!log) continue;
    taken.add(log);
    logged += 1;
    const ate = time(log.loggedAt);
    const off = symptoms.some((event) => {
      const at = time(event.loggedAt);
      return event.items.length > 0 && at > ate && at <= ate + FELT_OFF_HOURS * 3_600_000;
    });
    if (off) continue;
    well += 1;
    if (!wellTitles.includes(meal.dish.title)) wellTitles.push(meal.dish.title);
  }
  return { logged, well, wellTitles };
}

/** "5 of your 6 logged meals sat well. Keep those and plan the rest." for the next-week card. */
export function weekLine(logged: number, well: number): string {
  const how =
    well === logged
      ? logged === 1
        ? 'The meal you logged sat well.'
        : `All ${logged} of your logged meals sat well.`
      : `${well} of your ${logged} logged meals sat well.`;
  return `${how} Keep those and plan the rest.`;
}

/** The food to note as a possible trigger: the first ingredient's name, else the dish's own title. */
export function triggerName(meal: StoredMeal): string {
  const first = meal.dish.ingredients[0]?.trim();
  if (!first) return meal.dish.title;
  const name = first
    .toLowerCase()
    .replace(/^[\d\s/.¼½¾-]+/, '')
    .replace(
      /^(?:cups?|tbsp|tsp|oz|ounces?|lbs?|pounds?|g|kg|ml|l|cloves?|pieces?|fillets?|slices?)\b\s*(?:of\s+)?/,
      '',
    )
    .replace(/\s*[,(].*$/, '')
    .trim();
  return name.length >= 2 ? name : meal.dish.title;
}
