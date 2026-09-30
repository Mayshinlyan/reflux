import { ne } from 'drizzle-orm';

import {
  appSettings,
  foodLogs,
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
    tx.delete(foodLogs).run();
    tx.delete(medicationLogs).run();
    tx.delete(medications).run();
    tx.delete(savedFoods).run();
    tx.delete(appSettings).where(ne(appSettings.key, 'onboardingDone')).run();
  });
}
