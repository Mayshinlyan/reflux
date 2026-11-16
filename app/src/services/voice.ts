import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { File } from 'expo-file-system';

import {
  cleanCustomSymptom,
  CUSTOM_PREFIX,
  customSymptomLabel,
  isCustomSymptom,
  type LoggedSymptomKey,
  RETIRED_SYMPTOM_KEYS,
  SYMPTOM_KEYS,
  symptomKeyFromText,
} from '@/constants/symptomItems';
import { AppError } from '@/lib/errors';
import { currentTimeZone } from '@/lib/time';

import { fetchVoiceLog } from './relayClient';

/** The meals a person can name. Anything else the relay gives is treated as no label. */
export type MealLabel = 'breakfast' | 'lunch' | 'dinner' | 'snack';
const MEAL_LABELS: readonly MealLabel[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const isMealLabel = (value: unknown): value is MealLabel => MEAL_LABELS.includes(value as MealLabel);

/** One meal Bellie heard: the meal named (null if none), its foods, and when it was eaten (null = now). */
export type HeardMeal = { label: MealLabel | null; foods: string[]; at: Date | null };

/**
 * What Bellie heard in a spoken log: each meal with its own time, the symptoms, and `at`, when the symptoms were
 * felt (null = now). `at` only matters when no meal was said; symptoms said with a meal are logged after it.
 */
export type VoiceHeard = { meals: HeardMeal[]; symptoms: LoggedSymptomKey[]; at: Date | null };

/** Why a spoken log can't go on: the mic is off, nothing was heard, or Bellie couldn't be reached. */
export type VoiceProblem = 'permission' | 'nothing' | 'offline';

export class VoiceError extends Error {
  readonly problem: VoiceProblem;
  constructor(problem: VoiceProblem) {
    super(problem);
    this.name = 'VoiceError';
    this.problem = problem;
  }
}

/** `/log/voice?demo=<problem>` shows that problem on purpose, so each fallback screen can be tried on a phone. */
export const isVoiceProblem = (value: unknown): value is VoiceProblem =>
  value === 'permission' || value === 'nothing' || value === 'offline';

/** Asks for the microphone. Rejects with `permission` when it is off. */
export async function requestMicrophone(demo?: VoiceProblem): Promise<void> {
  if (demo === 'permission') throw new VoiceError('permission');
  let granted = false;
  try {
    granted = (await getRecordingPermissionsAsync()).granted;
    if (!granted) granted = (await requestRecordingPermissionsAsync()).granted;
  } catch {
    // A phone that can't even say is treated as "mic off".
  }
  if (!granted) throw new VoiceError('permission');
}

const MAX_FOODS = 8;
const MAX_MEALS = 5;
const MAX_FOOD_LENGTH = 40;

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The card title for a meal: the meal named ("Lunch"), or just "Food" when none was. */
export function mealTitle(meal: Pick<HeardMeal, 'label'>): string {
  return meal.label ? capitalise(meal.label) : 'Food';
}

const tidyFoods = (foods: readonly string[]) =>
  foods
    .map((food) => capitalise(Array.from(food.trim()).slice(0, MAX_FOOD_LENGTH).join('').trim()))
    .filter((food, index, all) => food.length > 0 && all.indexOf(food) === index)
    .slice(0, MAX_FOODS);

const parseTime = (iso: string | null) => {
  const parsed = iso ? new Date(iso) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

/**
 * The relay's answer as the app's own kinds. Each meal keeps its own label, foods and time. A relay from before
 * meals sends one list of foods and one time, which becomes one meal with no label. A built-in symptom (its key,
 * or its label in any capitals) stays a built-in key. Anything else is the person's own symptom: spelled as the
 * one they already saved when it matches that (any capitals), so "hiccup" never sits beside a saved "Hiccup", and
 * otherwise capitalised.
 */
export function toHeard(
  result: {
    foods: string[];
    symptoms: string[];
    at: string | null;
    meals?: { label: string | null; foods: string[]; at: string | null }[];
  },
  ownSymptoms: readonly string[] = [],
): VoiceHeard {
  let meals: HeardMeal[];
  if (result.meals !== undefined) {
    meals = result.meals
      .slice(0, MAX_MEALS)
      .map((meal) => ({
        label: isMealLabel(meal.label) ? meal.label : null,
        foods: tidyFoods(meal.foods),
        at: parseTime(meal.at),
      }))
      .filter((meal) => meal.foods.length > 0);
  } else {
    const foods = tidyFoods(result.foods);
    meals = foods.length > 0 ? [{ label: null, foods, at: parseTime(result.at) }] : [];
  }

  const symptoms: LoggedSymptomKey[] = [];
  for (const spoken of result.symptoms) {
    const text = spoken.trim().toLowerCase();
    const builtIn = SYMPTOM_KEYS.find((key) => key === text && !RETIRED_SYMPTOM_KEYS.includes(key));
    const typed = builtIn ? null : symptomKeyFromText(spoken);
    let key: LoggedSymptomKey | null = builtIn ?? typed;
    if (key && isCustomSymptom(key)) {
      const label = customSymptomLabel(key);
      const saved = ownSymptoms.find((name) => name.trim().toLowerCase() === label.toLowerCase());
      key = `${CUSTOM_PREFIX}${saved ? cleanCustomSymptom(saved) : capitalise(label)}`;
    }
    const lower = key?.toLowerCase();
    if (key && !symptoms.some((item) => item.toLowerCase() === lower)) symptoms.push(key);
  }

  // The symptoms' own time only matters when nothing was eaten; with a meal they are logged after it.
  return { meals, symptoms, at: meals.length > 0 ? null : parseTime(result.at) };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The phone's local time with its UTC offset, e.g. 2026-11-13T21:30:00-08:00, so "around eight" is worked out in the right zone. */
export function localIso(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** Own words sent to the relay to help it spell: trimmed, no repeats, cut to the relay's limits. */
const tidy = (names: readonly string[], max: number, length: number) =>
  names
    .map((name) => Array.from(name.replace(/\s+/g, ' ').trim()).slice(0, length).join('').trim())
    .filter((name, index, all) => name.length > 0 && all.indexOf(name) === index)
    .slice(0, max);

export type VoiceWords = {
  /** The person's saved and recent foods, and their own symptom names. */
  foods: readonly string[];
  symptoms: readonly string[];
};

/**
 * Sends the recording to the relay and works out what was said. Rejects with `nothing` when no food or symptom
 * was heard, or `offline` when Bellie couldn't be reached. `demo` skips the call to show a problem screen.
 */
export async function understand(
  audioUri: string | null,
  words: VoiceWords,
  demo?: VoiceProblem,
): Promise<VoiceHeard> {
  if (demo === 'offline') throw new VoiceError('offline');
  if (demo === 'nothing' || !audioUri) throw new VoiceError('nothing');
  let result;
  try {
    result = await fetchVoiceLog(audioUri, {
      now: localIso(new Date()),
      tz: currentTimeZone(),
      foods: tidy(words.foods, 40, 60),
      symptoms: tidy(words.symptoms, 20, 40),
    });
  } catch (error) {
    // The recording itself was turned down (empty, or not audio): nothing was heard. Anything else is Bellie out of reach.
    throw new VoiceError(
      error instanceof AppError && error.code === 'INPUT_REJECTED' ? 'nothing' : 'offline',
    );
  }
  const heard = toHeard(result, words.symptoms);
  if (heard.meals.length === 0 && heard.symptoms.length === 0) throw new VoiceError('nothing');
  return heard;
}

/** Deletes a recording from the phone once it is no longer needed. Never throws: a file already gone is fine. */
export function discardRecording(uri: string | null): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Nothing more to do; the cache is cleared by the phone eventually.
  }
}
