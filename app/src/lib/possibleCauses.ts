import type { MealAnalysis } from '@/types/analysis';

import { isLateMeal, minutesBeforeBed } from './mealTiming';
import { matchedTriggerLabels } from './verdictReasons';

type Input = {
  /** When the symptoms started (ISO). */
  symptomAt: string;
  /** The meal these symptoms were logged as following, if any. */
  meal?: { mealName: string; loggedAt: string; tz: string; analysis: MealAnalysis | null };
  bedtime: string;
  lateMealWindowMinutes: number;
};

const MAX_CAUSES = 3;

/** "40 minutes", "1 hour", "2 hours". */
function span(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, minutes)} ${minutes === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.round(minutes / 60);
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

/**
 * What the symptom entry offers as "Possibly related", worked out on the phone from what was logged (never
 * sent anywhere, never a diagnosis): the meal they followed and how long before, whether it was late, and the
 * trigger categories the meal check found. Empty when there is nothing to say.
 */
export function possibleCauses({ symptomAt, meal, bedtime, lateMealWindowMinutes }: Input): string[] {
  if (!meal) return [];
  const causes: string[] = [];
  const gap = Math.round((new Date(symptomAt).getTime() - new Date(meal.loggedAt).getTime()) / 60_000);
  if (gap >= 0) causes.push(`${meal.mealName}, ${span(gap)} before`);

  if (isLateMeal(meal.loggedAt, meal.tz, bedtime, lateMealWindowMinutes)) {
    const before = minutesBeforeBed(meal.loggedAt, meal.tz, bedtime) ?? 0;
    causes.push(
      before >= 0 ? `A late meal, ${span(before)} before bed` : `A late meal, ${span(-before)} after bedtime`,
    );
  }

  const triggers = meal.analysis ? matchedTriggerLabels(meal.analysis, { late: false }) : [];
  if (triggers.length > 0) causes.push(`In that meal: ${triggers.join(', ')}`);
  return causes.slice(0, MAX_CAUSES);
}
