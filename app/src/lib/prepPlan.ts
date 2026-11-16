import type { PrepPlanRequest, PrepPlanResult, PrepStepRef } from '@/types/prepPlan';

import type { PrepDish } from './prep';

/** The relay takes short ids; a swapped dish's own id is longer, so each dish goes by "d1", "d2" and back. */
export function prepAliases(dishes: readonly PrepDish[]): Map<string, string> {
  return new Map(dishes.slice(0, MAX_DISHES).map((entry, index) => [`d${index + 1}`, entry.dish.id]));
}

/** The relay plans up to this many dishes in one session. */
const MAX_DISHES = 8;

const cut = (text: string, max: number) => (text.length > max ? text.slice(0, max) : text);

/** The request for these dishes: what to cook with, and how long the person has. */
export function buildPrepRequest(dishes: readonly PrepDish[], prepMinutes: number): PrepPlanRequest {
  return {
    dishes: dishes.slice(0, MAX_DISHES).map(({ dish, meals }, index) => ({
      id: `d${index + 1}`,
      title: cut(dish.title, 60),
      minutes: Math.min(240, Math.max(1, Math.round(dish.minutes))),
      keepsDays: Math.min(7, Math.max(0, dish.keepsDays)),
      meals: Math.min(21, Math.max(1, meals.length)),
      ingredients: dish.ingredients.slice(0, 20).map((line) => cut(line, 120)),
      steps: dish.steps.slice(0, 12).map((line) => cut(line, 240)),
    })),
    ...(prepMinutes >= 30 && prepMinutes <= 240 ? { prepMinutes: Math.round(prepMinutes) } : {}),
  };
}

/** A short fingerprint of the dishes and their recipes: a saved session is only used while it still matches. */
export function prepSignature(dishes: readonly PrepDish[]): string {
  // The recipes only: how many meals are left changes as the days pass, and that must not start the session over.
  const text = dishes
    .map(({ dish }) => [dish.id, dish.title, dish.ingredients.join(','), dish.steps.join(',')].join('|'))
    .join('\n');
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

const isStep = (value: unknown): value is PrepStepRef => {
  if (typeof value !== 'object' || value === null) return false;
  const { text, feeds } = value as Record<string, unknown>;
  return (
    typeof text === 'string' &&
    text.length > 0 &&
    Array.isArray(feeds) &&
    feeds.every((id) => typeof id === 'string')
  );
};

/** True when `value` has the shape of the relay's prep session. */
export function isPrepPlanResult(value: unknown): value is PrepPlanResult {
  if (typeof value !== 'object' || value === null) return false;
  const { start, dishes, finish } = value as Record<string, unknown>;
  return (
    Array.isArray(start) &&
    start.every(isStep) &&
    Array.isArray(finish) &&
    finish.every(isStep) &&
    Array.isArray(dishes) &&
    dishes.length > 0 &&
    dishes.every((entry) => {
      if (typeof entry !== 'object' || entry === null) return false;
      const { dish, steps } = entry as Record<string, unknown>;
      return (
        typeof dish === 'string' &&
        Array.isArray(steps) &&
        steps.every((step) => typeof step === 'string' && step.length > 0)
      );
    })
  );
}

/** Every dish sent is covered exactly once, and no step points at a dish that was not sent. */
export function prepFitsDishes(result: PrepPlanResult, aliases: ReadonlyMap<string, string>): boolean {
  const covered = new Set(result.dishes.map((entry) => entry.dish));
  if (covered.size !== result.dishes.length || covered.size !== aliases.size) return false;
  for (const id of covered) if (!aliases.has(id)) return false;
  return [...result.start, ...result.finish].every((step) => step.feeds.every((id) => aliases.has(id)));
}

export type PrepStepView = { key: string; text: string };
export type PrepSection = { key: string; title: string; meta?: string; steps: PrepStepView[] };

/** "Keeps 4 days", "Keeps 1 day", or "Eat it the day it is cooked". */
export function keepsLine(days: number): string {
  if (days <= 0) return 'Eat it the day it is cooked';
  return `Keeps ${days} ${days === 1 ? 'day' : 'days'}`;
}

/**
 * The prep day as sections to show. With the relay's session: "Start together" (what the dishes share, plain
 * steps with no dish names under them), one section per dish under its own title, then "Finish together". Without it (one
 * dish, or the relay could not be reached): each dish's own steps under its title and one step to cool and pack.
 * Step keys carry the signature, so a changed plan starts with nothing ticked.
 */
export function prepSections(
  dishes: readonly PrepDish[],
  signature: string,
  result: PrepPlanResult | null,
  aliases: ReadonlyMap<string, string>,
): PrepSection[] {
  const byId = new Map(dishes.map((entry) => [entry.dish.id, entry]));

  if (!result) {
    const sections: PrepSection[] = dishes.map(({ dish }) => ({
      key: `${signature}:fb:${dish.id}`,
      title: dish.title,
      meta: keepsLine(dish.keepsDays),
      steps: dish.steps.map((text, index) => ({ key: `${signature}:fb:${dish.id}:${index}`, text })),
    }));
    if (sections.length > 0) {
      sections.push({
        key: `${signature}:fb:finish`,
        title: 'Finish together',
        steps: [{ key: `${signature}:fb:pack`, text: 'Cool everything, then pack and label' }],
      });
    }
    return sections;
  }

  const sections: PrepSection[] = [];
  if (result.start.length > 0) {
    sections.push({
      key: `${signature}:start`,
      title: 'Start together',
      meta: 'Steps that serve more than one dish',
      steps: result.start.map((step, index) => ({
        key: `${signature}:s${index}`,
        text: step.text,
      })),
    });
  }
  for (const entry of result.dishes) {
    const id = aliases.get(entry.dish);
    const found = id ? byId.get(id) : undefined;
    if (!found || entry.steps.length === 0) continue;
    sections.push({
      key: `${signature}:d:${found.dish.id}`,
      title: found.dish.title,
      meta: keepsLine(found.dish.keepsDays),
      steps: entry.steps.map((text, index) => ({ key: `${signature}:d:${found.dish.id}:${index}`, text })),
    });
  }
  if (result.finish.length > 0) {
    sections.push({
      key: `${signature}:finish`,
      title: 'Finish together',
      steps: result.finish.map((step, index) => ({
        key: `${signature}:f${index}`,
        text: step.text,
      })),
    });
  }
  return sections;
}
