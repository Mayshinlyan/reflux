import { isLateMeal } from './mealTiming';

/**
 * The pet's growth, derived from the log history every time it is read (nothing about
 * it is stored except its name and animal). Replaying the logs means editing or deleting
 * an entry, or changing bedtime, corrects the pet automatically. Encouraging by design:
 * progress never drops below 0, the stage never goes backwards, and taking medication or
 * logging symptoms is never punished more than a bad day is.
 */

export type PetStage = 0 | 1 | 2;
export type PetMood = 'happy' | 'unwell';
export type PetState = { stage: PetStage; progress: number; mood: PetMood };

export const STAGE_NAMES = ['Puppy', 'Young dog', 'Grown dog'] as const;
/** How large each stage is drawn, as a fraction of the full-size pet. */
export const STAGE_SCALE = [0.62, 0.82, 1] as const;
export const MAX_STAGE: PetStage = 2;

/** Every tunable delta lives here. */
export const PET_DELTAS = {
  food: { ok: 8, caution: -4, trigger: -10 },
  /** Extra penalty for a non-OK meal close to bedtime. */
  lateNonOk: -4,
  symptoms: { mild: 3, moderate: 0, severe: -8 },
  medication: 3,
} as const;

export type PetVerdict = keyof typeof PET_DELTAS.food;

export type PetLogs = {
  food: { loggedAt: string; tz: string; verdict: PetVerdict }[];
  /** `scores` are the 0-5 severities of the symptoms in one log. */
  symptoms: { loggedAt: string; scores: number[] }[];
  medications: { takenAt: string }[];
};

type Event = { at: string; delta: number };

export function symptomDelta(scores: readonly number[]): number {
  if (scores.length === 0) return PET_DELTAS.symptoms.moderate;
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  if (average <= 2) return PET_DELTAS.symptoms.mild;
  if (average < 4) return PET_DELTAS.symptoms.moderate;
  return PET_DELTAS.symptoms.severe;
}

export function foodDelta(verdict: PetVerdict, late: boolean): number {
  const base = PET_DELTAS.food[verdict];
  return verdict !== 'ok' && late ? base + PET_DELTAS.lateNonOk : base;
}

export function derivePetState(logs: PetLogs, bedtime: string, lateMealWindowMinutes: number): PetState {
  const events: Event[] = [
    ...logs.food.map((meal) => ({
      at: meal.loggedAt,
      delta: foodDelta(meal.verdict, isLateMeal(meal.loggedAt, meal.tz, bedtime, lateMealWindowMinutes)),
    })),
    ...logs.symptoms.map((log) => ({ at: log.loggedAt, delta: symptomDelta(log.scores) })),
    ...logs.medications.map((log) => ({ at: log.takenAt, delta: PET_DELTAS.medication })),
  ];
  // ISO UTC strings sort chronologically; Array.sort is stable so equal times keep order.
  events.sort((a, b) => a.at.localeCompare(b.at));

  let stage: PetStage = 0;
  let progress = 0;
  for (const { delta } of events) {
    progress = Math.max(0, progress + delta);
    while (progress >= 100 && stage < MAX_STAGE) {
      progress -= 100;
      stage = (stage + 1) as PetStage;
    }
    if (stage === MAX_STAGE) progress = Math.min(100, progress);
  }

  const last = events[events.length - 1];
  return { stage, progress, mood: last && last.delta < 0 ? 'unwell' : 'happy' };
}

/** Warm, never-blaming status lines. Mood is always shown as words, not colour alone. */
export function statusLine(name: string, mood: PetMood, hasLogs: boolean): string {
  if (mood === 'unwell') return `${name}'s feeling a little ruff today.`;
  return hasLogs ? `${name} is thriving!` : `${name} is happy to see you!`;
}
