import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useToast } from '@/components/Toast';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import { countDiaryMeals } from '@/db/repositories/food';
import { logger } from '@/lib/logger';
import { DEFAULT_REMINDER_MINUTES, REMINDER_PROMPT_AFTER_MEALS } from '@/lib/reminderTiming';
import { askForReminders } from '@/services/reminders';

/**
 * State for the one-time "Want a gentle nudge?" sheet (ReminderPromptSheet). It shows on Today once, after a few
 * meals, for anyone who hasn't been asked yet (they skipped it in onboarding). Either answer counts as asked.
 */
export function useReminderPrompt() {
  const db = useDb();
  const toast = useToast();
  const { settings, update } = useSettings();
  const [visible, setVisible] = useState(false);
  const eligible =
    settings.onboardingDone && !settings.reminderAsked && settings.checkInReminderMinutes === null;

  useFocusEffect(
    useCallback(() => {
      if (!eligible) return;
      try {
        if (countDiaryMeals(db) >= REMINDER_PROMPT_AFTER_MEALS) setVisible(true);
      } catch (error) {
        logger.error('countMeals', error);
      }
    }, [db, eligible]),
  );

  const markAsked = (minutes?: number) => {
    try {
      update('reminderAsked', true);
      if (minutes !== undefined) update('checkInReminderMinutes', minutes);
    } catch (error) {
      logger.error('saveReminders', error);
    }
  };

  return {
    visible,
    hide: () => setVisible(false),
    /** "Yes please": asks the phone, then turns it on if allowed. */
    accept: async () => {
      const allowed = await askForReminders();
      markAsked(allowed ? DEFAULT_REMINDER_MINUTES : undefined);
      if (allowed) toast('Reminders are on');
    },
    /** "Not now": not asked again. It can still be turned on in Settings. */
    decline: () => markAsked(),
  };
}
