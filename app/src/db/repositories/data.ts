import { count, eq, ne } from 'drizzle-orm';

import {
  appSettings,
  foodLogs,
  foodLogTags,
  medicationLogs,
  medications,
  savedFoods,
  symptomLogItems,
  symptomLogs,
  symptomLogTags,
} from '../schema';
import type { AppDb } from '../types';

/**
 * Deletes everything the user has logged (symptoms, meals and checks, medications and their
 * history) and resets the pet and bedtime to their defaults, in one transaction. `onboardingDone`
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
    tx.delete(appSettings).where(ne(appSettings.key, 'onboardingDone')).run();
  });
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
