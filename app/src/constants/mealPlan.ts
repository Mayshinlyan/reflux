import { isCuisineKey } from './cuisines';
import type { CuisineKey } from './cuisines';

/**
 * Cook once: one prep session, every meal reheated from it. Cook daily: no prep day, each meal cooked that day.
 * Keys match the relay's `PLAN_MODES` (Figma "meal planning flow").
 */
export const PLAN_MODES = [
  { value: 'once', label: 'Cook once' },
  { value: 'daily', label: 'Cook daily' },
] as const;

export type PlanMode = (typeof PLAN_MODES)[number]['value'];

export const isPlanMode = (value: unknown): value is PlanMode =>
  typeof value === 'string' && PLAN_MODES.some((mode) => mode.value === value);

/** The meals of a day, in the order they are eaten. Keys match the relay's `PLAN_SLOTS`. */
export const PLAN_SLOTS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
] as const;

export type PlanSlot = (typeof PLAN_SLOTS)[number]['value'];

export const isPlanSlot = (value: unknown): value is PlanSlot =>
  typeof value === 'string' && PLAN_SLOTS.some((slot) => slot.value === value);

export function slotLabel(slot: PlanSlot): string {
  return PLAN_SLOTS.find((item) => item.value === slot)?.label ?? 'Meal';
}

/** How long the prep session may take, as segmented-control options (the value is minutes as text). */
export const PREP_TIMES = [
  { value: '60', label: '1 hr' },
  { value: '120', label: '2 hrs' },
  { value: '180', label: '3 hrs' },
] as const;

/** The relay allows 1 to 4 cuisines in one plan. */
export const MAX_PLAN_CUISINES = 4;

/** What the set-up sheet holds, kept so it opens as it was left. Days are weekdays (0 = Sunday to 6 = Saturday). */
export type PlanChoices = {
  weekdays: number[];
  meals: PlanSlot[];
  cuisines: CuisineKey[];
  mode: PlanMode;
  /** Cook once only: minutes for the prep session. */
  prepMinutes: number;
  useFridge: boolean;
};

export const DEFAULT_PLAN_CHOICES: PlanChoices = {
  weekdays: [1, 2, 3, 4, 5, 6, 0],
  meals: ['lunch', 'dinner'],
  cuisines: ['any'],
  mode: 'once',
  prepMinutes: 120,
  useFridge: true,
};

const distinct = <T>(items: readonly T[]) => new Set(items).size === items.length;

export function isPlanChoices(value: unknown): value is PlanChoices {
  if (typeof value !== 'object' || value === null) return false;
  const choices = value as Partial<PlanChoices>;
  return (
    Array.isArray(choices.weekdays) &&
    choices.weekdays.length > 0 &&
    choices.weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) &&
    distinct(choices.weekdays) &&
    Array.isArray(choices.meals) &&
    choices.meals.length > 0 &&
    choices.meals.every(isPlanSlot) &&
    distinct(choices.meals) &&
    Array.isArray(choices.cuisines) &&
    choices.cuisines.length > 0 &&
    choices.cuisines.length <= MAX_PLAN_CUISINES &&
    choices.cuisines.every(isCuisineKey) &&
    distinct(choices.cuisines) &&
    isPlanMode(choices.mode) &&
    Number.isInteger(choices.prepMinutes) &&
    (choices.prepMinutes as number) >= 30 &&
    (choices.prepMinutes as number) <= 240 &&
    typeof choices.useFridge === 'boolean'
  );
}
