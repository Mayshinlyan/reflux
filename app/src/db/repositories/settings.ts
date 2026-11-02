import { eq } from 'drizzle-orm';

import { AVATAR_KEYS, type AvatarKey } from '@/constants/avatars';
import { CONDITION_KEYS, type ConditionKey, legacyCondition, readConditions } from '@/constants/conditions';
import {
  type CuisineKey,
  isCuisineKey,
  isRecipeTime,
  MAX_SERVES,
  MIN_SERVES,
  type RecipeTime,
} from '@/constants/cuisines';
import { RETIRED_SYMPTOM_KEYS, SYMPTOM_KEYS, type SymptomKey } from '@/constants/symptomItems';
import { type PetAnimal, PETS } from '@/lib/pets';
import { isRecipe } from '@/lib/recipe';
import { REMINDER_OPTIONS } from '@/lib/reminderTiming';
import { nowIso } from '@/lib/time';
import type { Recipe } from '@/types/recipe';

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
  /** The built-in avatar shown on You; 'initial' is the first letter of the name. */
  avatar: AvatarKey;
  /** What the user is managing, any number of them or just 'unsure' (shown on Profile, sent to meal checks). */
  conditions: ConditionKey[];
  /** Symptoms they usually feel; the symptom log lists these first. */
  usualSymptoms: SymptomKey[];
  petName: string;
  petAnimal: PetAnimal;
  /** The highest pet stage (0-2) the user has seen on Today; a higher derived stage plays the celebration once. */
  petSeenStage: number;
  /** Minutes after a meal when the check-in reminder fires; null = off (the default). */
  checkInReminderMinutes: number | null;
  /** True once they have been asked about reminders (onboarding, the one-time sheet or Settings), so it's asked once. */
  reminderAsked: boolean;
  /** Made on this phone and only ever written to the home-screen widget; a link that logs a meal must carry it. */
  widgetToken: string;
  /** True once the first-run app tour has been finished or closed, so it starts only once ("Replay app tour" is in Settings). */
  tourDone: boolean;
  /** Whether Bellie's day and week summaries may be asked of the AI service. Off keeps the words made on the phone. */
  summariesEnabled: boolean;
  /** The Kitchen sheet's last choices, so it opens as you left it (Figma row 29b). */
  kitchenCuisine: CuisineKey;
  kitchenTime: RecipeTime;
  kitchenServes: number;
  /** How many Kitchen rounds (three ideas each) were made on `day` (a local "YYYY-MM-DD"); a new day starts at none. */
  kitchenRounds: { day: string; count: number };
  /** The last round of ideas, kept so "AI Ideas" can bring them back after the sheet is closed or the app restarted. */
  kitchenIdeas: { cuisine: CuisineKey; recipes: Recipe[] } | null;
};

export const DEFAULT_SETTINGS: Settings = {
  bedtime: '22:30',
  lateMealWindowMinutes: 180,
  onboardingDone: false,
  userName: '',
  avatar: 'initial',
  conditions: ['unsure'],
  usualSymptoms: [],
  petName: PETS.mochi.defaultName,
  petAnimal: 'mochi',
  petSeenStage: 0,
  checkInReminderMinutes: null,
  reminderAsked: false,
  widgetToken: '',
  tourDone: false,
  summariesEnabled: true,
  kitchenCuisine: 'any',
  kitchenTime: '40',
  kitchenServes: 2,
  kitchenRounds: { day: '', count: 0 },
  kitchenIdeas: null,
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
  if (key === 'avatar' && !AVATAR_KEYS.includes(value as AvatarKey)) {
    throw new Error(`Unknown avatar: ${value as string}`);
  }
  if (key === 'conditions') {
    const keys = value as ConditionKey[];
    const valid =
      Array.isArray(keys) &&
      keys.length > 0 &&
      keys.every((item) => CONDITION_KEYS.includes(item)) &&
      new Set(keys).size === keys.length &&
      (!keys.includes('unsure') || keys.length === 1);
    if (!valid) throw new Error("conditions must be distinct known conditions, with 'unsure' only alone");
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
  if (key === 'checkInReminderMinutes') {
    const minutes = value as number | null;
    if (minutes !== null && !REMINDER_OPTIONS.includes(minutes)) {
      throw new Error('checkInReminderMinutes must be null or one of the offered options');
    }
  }
  if (key === 'lateMealWindowMinutes') {
    const minutes = value as number;
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 360) {
      throw new Error('lateMealWindowMinutes must be 0–360');
    }
  }
  if (key === 'kitchenCuisine' && !isCuisineKey(value)) throw new Error(`Unknown cuisine: ${String(value)}`);
  if (key === 'kitchenTime' && !isRecipeTime(value)) throw new Error(`Unknown recipe time: ${String(value)}`);
  if (key === 'kitchenServes') {
    const serves = value as number;
    if (!Number.isInteger(serves) || serves < MIN_SERVES || serves > MAX_SERVES) {
      throw new Error(`kitchenServes must be ${MIN_SERVES}–${MAX_SERVES}`);
    }
  }
  if (key === 'kitchenRounds') {
    const rounds = value as Settings['kitchenRounds'];
    if (typeof rounds?.day !== 'string' || !Number.isInteger(rounds.count) || rounds.count < 0) {
      throw new Error('kitchenRounds must be a day and a count');
    }
  }
  if (key === 'kitchenIdeas') {
    const ideas = value as Settings['kitchenIdeas'];
    const valid =
      ideas === null ||
      (isCuisineKey(ideas?.cuisine) && Array.isArray(ideas.recipes) && ideas.recipes.every(isRecipe));
    if (!valid) throw new Error('kitchenIdeas must be null or a cuisine with recipes');
  }
}

/** Before `conditions` there was one `condition` row; carry it over (`gerd` is now acid reflux). */
function legacyConditions(raw: string | undefined): ConditionKey[] | null {
  if (raw === undefined) return null;
  try {
    const legacy = legacyCondition(JSON.parse(raw));
    return legacy ? [legacy] : null;
  } catch {
    return null;
  }
}

export function getSetting<K extends SettingKey>(db: AppDb, key: K): Settings[K] {
  const row = db.select().from(appSettings).where(eq(appSettings.key, key)).get();
  if (!row && key === 'conditions') {
    const old = db.select().from(appSettings).where(eq(appSettings.key, 'condition')).get();
    return (legacyConditions(old?.value) ?? DEFAULT_SETTINGS[key]) as Settings[K];
  }
  if (!row) return DEFAULT_SETTINGS[key];
  try {
    const value = JSON.parse(row.value);
    if (key === 'conditions') return (readConditions(value) ?? DEFAULT_SETTINGS[key]) as Settings[K];
    return value as Settings[K];
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
    if (raw === undefined) {
      if (key === 'conditions')
        settings.conditions = legacyConditions(stored.get('condition')) ?? settings.conditions;
      continue;
    }
    try {
      const value = JSON.parse(raw);
      (settings as Record<SettingKey, unknown>)[key] =
        key === 'conditions' ? (readConditions(value) ?? DEFAULT_SETTINGS.conditions) : value;
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
