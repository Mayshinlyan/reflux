import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import {
  CHECK_IN_TITLE,
  checkInBody,
  checkInTime,
  isQuietTime,
  REPORT_BODY,
  REPORT_TITLE,
} from '@/lib/reminderTiming';

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
    importance: AndroidImportance.DEFAULT,
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

const REPORT_ID = 'weekly-report';
/** Sunday (1 is Sunday in an expo-notifications weekly trigger) at 6 pm, as the week has just ended. */
const REPORT_WEEKDAY = 1;
const REPORT_HOUR = 18;

/**
 * Schedules the weekly "Your week with Bellie" notification (Figma 42f): every Sunday evening, on the phone like the
 * check-in. The same identifier replaces any earlier one, so calling this again is safe. It never asks for permission.
 */
export async function scheduleWeeklyReport(): Promise<'scheduled' | 'denied' | 'failed'> {
  try {
    if (!(await remindersAllowed())) return 'denied';
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: REPORT_ID,
      content: { title: REPORT_TITLE, body: REPORT_BODY, data: { report: true } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: REPORT_WEEKDAY,
        hour: REPORT_HOUR,
        minute: 0,
        channelId: CHANNEL,
      },
    });
    return 'scheduled';
  } catch (error) {
    logger.error('scheduleWeeklyReport', error);
    return 'failed';
  }
}

/** Drops the weekly notification: check-in reminders were turned off. Safe if none is scheduled. */
export async function cancelWeeklyReport(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(REPORT_ID);
  } catch (error) {
    logger.error('cancelWeeklyReport', error);
  }
}

/** True for a tap on the weekly notification itself (not another action on it). */
export function isReportResponse(response: Notifications.NotificationResponse): boolean {
  return (
    response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER &&
    response.notification.request.content.data?.report === true
  );
}

/** The meal a tapped reminder is about, or null for anything else (another action, an unknown notification). */
export function mealIdFromResponse(response: Notifications.NotificationResponse): number | null {
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return null;
  const id = response.notification.request.content.data?.foodLogId;
  return typeof id === 'number' && Number.isInteger(id) ? id : null;
}
