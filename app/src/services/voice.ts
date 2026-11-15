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

/** What Bellie heard in a spoken log: the foods, the symptoms, and when (null = now). */
export type VoiceHeard = { foods: string[]; symptoms: LoggedSymptomKey[]; at: Date | null };

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
const MAX_FOOD_LENGTH = 40;

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The relay's answer as the app's own kinds. A built-in symptom (its key, or its label in any capitals) stays a
 * built-in key. Anything else is the person's own symptom: spelled as the one they already saved when it matches
 * that (any capitals), so "hiccup" never sits beside a saved "Hiccup", and otherwise capitalised.
 */
export function toHeard(
  result: { foods: string[]; symptoms: string[]; at: string | null },
  ownSymptoms: readonly string[] = [],
): VoiceHeard {
  const foods = result.foods
    .map((food) => capitalise(Array.from(food.trim()).slice(0, MAX_FOOD_LENGTH).join('').trim()))
    .filter((food, index, all) => food.length > 0 && all.indexOf(food) === index)
    .slice(0, MAX_FOODS);

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

  const parsed = result.at ? new Date(result.at) : null;
  return { foods, symptoms, at: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null };
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
  if (heard.foods.length === 0 && heard.symptoms.length === 0) throw new VoiceError('nothing');
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
