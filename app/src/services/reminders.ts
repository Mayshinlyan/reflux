import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { CHECK_IN_TITLE, checkInBody, checkInTime, isQuietTime } from '@/lib/reminderTiming';

/**
 * The check-in reminder: a local notification a while after a meal asking how they feel. It is scheduled on the
 * phone, so there is no push token and no server, and nothing about the meal leaves the device. Errors are logged
 * with a code only, never the meal name.
 */

const CHANNEL = 'check-in';
const idFor = (mealId: number) => `meal-${mealId}`;

export type ScheduleResult = 'scheduled' | 'quiet' | 'past' | 'denied' | 'failed';

/** Shows a reminder that arrives while the app is open, quietly. Call once at startup. */
export function setupReminders(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Android 8+ needs a channel before anything can show. */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Check-in reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Whether reminders can show right now, without asking. */
export async function remindersAllowed(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch (error) {
    logger.error('remindersAllowed', error);
    return false;
  }
}

/** Asks the phone for permission (it only ever shows its prompt once) and says whether reminders can show. */
export async function askForReminders(): Promise<boolean> {
  try {
    await ensureChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch (error) {
    logger.error('askForReminders', error);
    return false;
  }
}

/**
 * Schedules the check-in for a meal. Does nothing when it would fire in the past (an older meal), land in the quiet
 * hours after bedtime, or the phone isn't allowing notifications; it never asks for permission itself.
 */
export async function scheduleCheckIn(args: {
  mealId: number;
  mealName: string;
  eatenAt: Date;
  minutes: number;
  bedtime: string;
  now?: Date;
}): Promise<ScheduleResult> {
  const { mealId, mealName, eatenAt, minutes, bedtime, now = new Date() } = args;
  const fireAt = checkInTime(eatenAt, minutes);
  if (fireAt <= now) return 'past';
  if (isQuietTime(fireAt, bedtime)) return 'quiet';
  try {
    if (!(await remindersAllowed())) return 'denied';
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: idFor(mealId),
      content: { title: CHECK_IN_TITLE, body: checkInBody(mealName, minutes), data: { foodLogId: mealId } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: CHANNEL },
    });
    return 'scheduled';
  } catch {
    // Code only: the error could echo the notification body, which names the meal.
    logger.error('scheduleCheckIn', new AppError('INTERNAL'));
    return 'failed';
  }
}

/** Drops the reminder for a meal: they already checked in, or the meal was deleted. Safe if none is scheduled. */
export async function cancelCheckIn(mealId: number): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(idFor(mealId));
  } catch (error) {
    logger.error('cancelCheckIn', error);
  }
}

/** Drops every pending reminder: reminders were turned off, or all data was deleted. */
export async function cancelAllCheckIns(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    logger.error('cancelAllCheckIns', error);
  }
}

/** The meal a tapped reminder is about, or null for anything else (another action, an unknown notification). */
export function mealIdFromResponse(response: Notifications.NotificationResponse): number | null {
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return null;
  const id = response.notification.request.content.data?.foodLogId;
  return typeof id === 'number' && Number.isInteger(id) ? id : null;
}
