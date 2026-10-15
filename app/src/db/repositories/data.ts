import { and, asc, count, eq, lte, ne } from 'drizzle-orm';

import { localDayKey } from '@/lib/localDay';

import {
  appSettings,
  foodLogs,
  foodLogTags,
  medicationLogs,
  medications,
  savedFoods,
  savedSymptoms,
  symptomLogItems,
  symptomLogs,
  symptomLogTags,
} from '../schema';
import type { AppDb } from '../types';
import { notifySavedFoodsChanged } from './savedFoods';

/**
 * Deletes everything the user has logged (symptoms, meals and checks, medications and their
 * history) and resets the name, pet and bedtime to their defaults, in one transaction. `onboardingDone`
 * is kept so a returning user isn't shown the welcome screen again. Meal photos live outside the
 * database; the caller removes them with `deleteAllPhotos()`.
 */
export function deleteAllData(db: AppDb): void {
  db.transaction((tx) => {
    // Children first, so this doesn't depend on foreign-key cascades being enabled.
    tx.delete(symptomLogItems).run();
    tx.delete(symptomLogTags).run();
    tx.delete(symptomLogs).run();
    tx.delete(foodLogTags).run();
    tx.delete(foodLogs).run();
    tx.delete(medicationLogs).run();
    tx.delete(medications).run();
    tx.delete(savedFoods).run();
    tx.delete(savedSymptoms).run();
    tx.delete(appSettings).where(ne(appSettings.key, 'onboardingDone')).run();
  });
  notifySavedFoodsChanged(); // the widget lists saved foods and holds a token that was just reset
}

/** Time zones are at most 14 hours apart, so entries within 36 hours of the oldest may be on an earlier local day. */
const ZONE_SLACK_MS = 36 * 60 * 60 * 1000;

/**
 * The local day ("YYYY-MM-DD") of the oldest diary entry: a meal, symptom log or dose, each placed on the
 * day of the zone it was logged in. Undefined when nothing is logged. History uses it as the start of "all
 * time" and to stop stepping back.
 */
export function earliestEntryDayKey(db: AppDb): string | undefined {
  const within = (oldest: string) => new Date(new Date(oldest).getTime() + ZONE_SLACK_MS).toISOString();
  const days: string[] = [];

  const oldestMeal = db
    .select({ at: foodLogs.loggedAt })
    .from(foodLogs)
    .where(eq(foodLogs.entryType, 'diary'))
    .orderBy(asc(foodLogs.loggedAt))
    .limit(1)
    .get();
  if (oldestMeal) {
    db.select({ at: foodLogs.loggedAt, tz: foodLogs.tz })
      .from(foodLogs)
      .where(and(eq(foodLogs.entryType, 'diary'), lte(foodLogs.loggedAt, within(oldestMeal.at))))
      .all()
      .forEach((row) => days.push(localDayKey(row.at, row.tz)));
  }

  const oldestSymptom = db
    .select({ at: symptomLogs.loggedAt })
    .from(symptomLogs)
    .orderBy(asc(symptomLogs.loggedAt))
    .limit(1)
    .get();
  if (oldestSymptom) {
    db.select({ at: symptomLogs.loggedAt, tz: symptomLogs.tz })
      .from(symptomLogs)
      .where(lte(symptomLogs.loggedAt, within(oldestSymptom.at)))
      .all()
      .forEach((row) => days.push(localDayKey(row.at, row.tz)));
  }

  const oldestDose = db
    .select({ at: medicationLogs.takenAt })
    .from(medicationLogs)
    .orderBy(asc(medicationLogs.takenAt))
    .limit(1)
    .get();
  if (oldestDose) {
    db.select({ at: medicationLogs.takenAt, tz: medicationLogs.tz })
      .from(medicationLogs)
      .where(lte(medicationLogs.takenAt, within(oldestDose.at)))
      .all()
      .forEach((row) => days.push(localDayKey(row.at, row.tz)));
  }

  return days.sort()[0];
}

/**
 * How many entries the user has logged: diary meals (checked or not), symptom logs and
 * medication doses. One-off food checks aren't logs until they're eaten. Coins are derived
 * from this, so deleting an entry takes its coin back and nothing about coins is stored.
 */
export function countLoggedEntries(db: AppDb): number {
  const meals = db.select({ n: count() }).from(foodLogs).where(eq(foodLogs.entryType, 'diary')).get()?.n ?? 0;
  const symptoms = db.select({ n: count() }).from(symptomLogs).get()?.n ?? 0;
  const doses = db.select({ n: count() }).from(medicationLogs).get()?.n ?? 0;
  return meals + symptoms + doses;
}
