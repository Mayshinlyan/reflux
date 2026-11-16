import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useSettings } from '@/db/DatabaseProvider';
import { openSymptoms } from '@/hooks/useSymptomPrompt';
import {
  cancelWeeklyReport,
  isPlanResponse,
  isReportResponse,
  mealIdFromResponse,
  scheduleWeeklyReport,
} from '@/services/reminders';

/**
 * Opens the symptom check-in for the meal when a check-in reminder is tapped, "Your week with Bellie" when the Sunday
 * notification is, and the new week plan when "Your week is ready" is, including when the tap is what launched the
 * app. It also keeps that weekly notification scheduled for as long as check-in reminders are on, and drops it when
 * they are off. Renders nothing.
 */
export function CheckInRouter() {
  // undefined until it knows, null when the app wasn't opened by a notification.
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  const { settings } = useSettings();
  const remindersOn = settings.checkInReminderMinutes !== null;

  useEffect(() => {
    if (remindersOn) void scheduleWeeklyReport();
    else void cancelWeeklyReport();
  }, [remindersOn]);

  useEffect(() => {
    if (!response) return;
    const key = `${response.notification.request.identifier}:${response.notification.date}`;
    if (handled.current === key) return;
    handled.current = key;
    // The hook keeps the last response until it is cleared, so a remount would open it a second time.
    void Notifications.clearLastNotificationResponseAsync();
    // Let the navigator finish mounting when the tap launched the app.
    if (isReportResponse(response)) {
      setTimeout(() => router.push('/weekly-report'), 0);
      return;
    }
    if (isPlanResponse(response)) {
      setTimeout(() => router.push('/plan'), 0);
      return;
    }
    const mealId = mealIdFromResponse(response);
    if (mealId !== null) setTimeout(() => openSymptoms(mealId), 0);
  }, [response]);

  return null;
}
