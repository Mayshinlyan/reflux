import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';

import { openSymptoms } from '@/hooks/useSymptomPrompt';
import { mealIdFromResponse } from '@/services/reminders';

/**
 * Opens the symptom check-in for the meal when a check-in reminder is tapped, including when the tap is what
 * launched the app. Renders nothing.
 */
export function CheckInRouter() {
  // undefined until it knows, null when the app wasn't opened by a notification.
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!response) return;
    const key = `${response.notification.request.identifier}:${response.notification.date}`;
    if (handled.current === key) return;
    handled.current = key;
    // The hook keeps the last response until it is cleared, so a remount would open it a second time.
    void Notifications.clearLastNotificationResponseAsync();
    const mealId = mealIdFromResponse(response);
    // Let the navigator finish mounting when the tap launched the app.
    if (mealId !== null) setTimeout(() => openSymptoms(mealId), 0);
  }, [response]);

  return null;
}
