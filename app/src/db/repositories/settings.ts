import { eq } from 'drizzle-orm';

import { CONDITION_KEYS, type ConditionKey } from '@/constants/conditions';
import { RETIRED_SYMPTOM_KEYS, SYMPTOM_KEYS, type SymptomKey } from '@/constants/symptomItems';
import { type PetAnimal, PETS } from '@/lib/pets';
import { nowIso } from '@/lib/time';

import { appSettings } from '../schema';
import type { AppDb } from '../types';

/**
 * Typed app settings. Pet stage, progress and mood are deliberately absent: they are
 * derived from the logs (lib/petProgress.ts), so only the pet's identity is stored, plus
 * the last stage the user saw (so a stage-up is celebrated once).
 */
export type Settings = {
  /** Local bedtime, "HH:MM" 24h. */
  bedtime: string;
  /** A meal this many minutes (or fewer) before bedtime is flagged as late. */
  lateMealWindowMinutes: number;
  onboardingDone: boolean;
  /** What the app calls the user (Today's greeting); empty until they set one in You. */
  userName: string;
  /** What the user is managing, from onboarding (shown on Profile). */
  condition: ConditionKey;
  /** Symptoms they usually feel; the symptom log lists these first. */
  usualSymptoms: SymptomKey[];
  petName: string;
  petAnimal: PetAnimal;
  /** The highest pet stage (0-2) the user has seen on Today; a higher derived stage plays the celebration once. */
  petSeenStage: number;
};

export const DEFAULT_SETTINGS: Settings = {
  bedtime: '22:30',
  lateMealWindowMinutes: 180,
  onboardingDone: false,
  userName: '',
  condition: 'unsure',
  usualSymptoms: [],
  petName: PETS.mochi.defaultName,
  petAnimal: 'mochi',
  petSeenStage: 0,
};

export type SettingKey = keyof Settings;

/** Longest name the greeting has room for. */
export const USER_NAME_MAX = 24;

const BEDTIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function validate<K extends SettingKey>(key: K, value: Settings[K]): void {
  if (key === 'bedtime' && !BEDTIME_PATTERN.test(value as string)) {
    throw new Error('bedtime must be HH:MM (24h)');
  }
  if (key === 'petName') {
    const name = (value as string).trim();
    if (name.length < 1 || name.length > 24) throw new Error('petName must be 1–24 characters');
  }
  if (key === 'userName' && (value as string).length > USER_NAME_MAX) {
    throw new Error(`userName must be at most ${USER_NAME_MAX} characters`);
  }
  if (key === 'condition' && !CONDITION_KEYS.includes(value as ConditionKey)) {
    throw new Error(`Unknown condition: ${value as string}`);
  }
  if (key === 'usualSymptoms') {
    const keys = value as SymptomKey[];
    const offered = (symptom: SymptomKey) =>
      SYMPTOM_KEYS.includes(symptom) && !RETIRED_SYMPTOM_KEYS.includes(symptom);
    if (!Array.isArray(keys) || !keys.every(offered) || new Set(keys).size !== keys.length) {
      throw new Error('usualSymptoms must be distinct symptoms that are still offered');
    }
  }
  if (key === 'petSeenStage') {
    const stage = value as number;
    if (!Number.isInteger(stage) || stage < 0 || stage > 2) throw new Error('petSeenStage must be 0–2');
  }
  if (key === 'lateMealWindowMinutes') {
    const minutes = value as number;
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 360) {
      throw new Error('lateMealWindowMinutes must be 0–360');
    }
  }
}

export function getSetting<K extends SettingKey>(db: AppDb, key: K): Settings[K] {
  const row = db.select().from(appSettings).where(eq(appSettings.key, key)).get();
  if (!row) return DEFAULT_SETTINGS[key];
  try {
    return JSON.parse(row.value) as Settings[K];
  } catch {
    return DEFAULT_SETTINGS[key];
  }
}

export function getAllSettings(db: AppDb): Settings {
  const stored = new Map(
    db
      .select()
      .from(appSettings)
      .all()
      .map((row) => [row.key, row.value]),
  );
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
    const raw = stored.get(key);
    if (raw === undefined) continue;
    try {
      (settings as Record<SettingKey, unknown>)[key] = JSON.parse(raw);
    } catch {
      // Keep the default for a corrupt value.
    }
  }
  return settings;
}

export function setSetting<K extends SettingKey>(db: AppDb, key: K, value: Settings[K]): void {
  const normalized = (
    key === 'petName' || key === 'userName' ? (value as string).trim() : value
  ) as Settings[K];
  validate(key, normalized);
  const json = JSON.stringify(normalized);
  db.insert(appSettings)
    .values({ key, value: json, updatedAt: nowIso() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: json, updatedAt: nowIso() } })
    .run();
}
