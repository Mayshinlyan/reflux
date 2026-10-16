import * as Notifications from 'expo-notifications';

import {
  askForReminders,
  cancelAllCheckIns,
  cancelCheckIn,
  mealIdFromResponse,
  remindersAllowed,
  scheduleCheckIn,
} from '../reminders';

jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));

const mocked = jest.mocked(Notifications);

/** A local-time Date, whatever the machine's zone. */
const at = (hours: number, minutes = 0) => new Date(2026, 9, 14, hours, minutes);

const meal = { mealId: 7, mealName: 'Spicy chicken tacos', bedtime: '22:30', minutes: 120 };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('scheduleCheckIn', () => {
  it('schedules one notification for the meal, at the chosen time, naming the meal', async () => {
    const result = await scheduleCheckIn({ ...meal, eatenAt: at(12, 30), now: at(12, 31) });

    expect(result).toBe('scheduled');
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'meal-7',
      content: {
        title: 'How are you feeling?',
        body: 'You had Spicy chicken tacos about 2 hours ago. Tap to check in.',
        data: { foodLogId: 7 },
      },
      trigger: { type: 'date', date: at(14, 30), channelId: 'check-in' },
    });
  });

  it('skips a meal whose reminder would already have fired', async () => {
    const result = await scheduleCheckIn({ ...meal, eatenAt: at(9, 0), now: at(12, 0) });

    expect(result).toBe('past');
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('skips a reminder that would land after bedtime', async () => {
    const result = await scheduleCheckIn({ ...meal, eatenAt: at(21, 0), now: at(21, 1) });

    expect(result).toBe('quiet');
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('does not ask for permission, and skips when the phone is not allowing notifications', async () => {
    mocked.getPermissionsAsync.mockResolvedValueOnce({ granted: false } as never);

    const result = await scheduleCheckIn({ ...meal, eatenAt: at(12, 30), now: at(12, 31) });

    expect(result).toBe('denied');
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('reports a failure instead of throwing', async () => {
    mocked.scheduleNotificationAsync.mockRejectedValueOnce(new Error('boom'));

    await expect(scheduleCheckIn({ ...meal, eatenAt: at(12, 30), now: at(12, 31) })).resolves.toBe('failed');
  });
});

describe('cancelling', () => {
  it('drops one meal’s reminder by its identifier', async () => {
    await cancelCheckIn(7);

    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith('meal-7');
  });

  it('drops every reminder', async () => {
    await cancelAllCheckIns();

    expect(mocked.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
  });

  it('never throws', async () => {
    mocked.cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error('boom'));
    mocked.cancelAllScheduledNotificationsAsync.mockRejectedValueOnce(new Error('boom'));

    await expect(cancelCheckIn(7)).resolves.toBeUndefined();
    await expect(cancelAllCheckIns()).resolves.toBeUndefined();
  });
});

describe('permission', () => {
  it('says whether reminders can show without asking', async () => {
    await expect(remindersAllowed()).resolves.toBe(true);

    mocked.getPermissionsAsync.mockResolvedValueOnce({ granted: false } as never);
    await expect(remindersAllowed()).resolves.toBe(false);
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('does not show the phone’s prompt when it is already allowed', async () => {
    await expect(askForReminders()).resolves.toBe(true);

    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('asks once when it is not allowed yet, and reports the answer', async () => {
    mocked.getPermissionsAsync.mockResolvedValueOnce({ granted: false } as never);
    mocked.requestPermissionsAsync.mockResolvedValueOnce({ granted: false } as never);

    await expect(askForReminders()).resolves.toBe(false);
    expect(mocked.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('treats a failure as not allowed', async () => {
    mocked.getPermissionsAsync.mockRejectedValueOnce(new Error('boom'));

    await expect(askForReminders()).resolves.toBe(false);
  });
});

describe('mealIdFromResponse', () => {
  const response = (actionIdentifier: string, data?: Record<string, unknown>) =>
    ({
      actionIdentifier,
      notification: { request: { content: { data } } },
    }) as never;
  const TAP = 'expo.modules.notifications.actions.DEFAULT';

  it('reads the meal from a tapped reminder', () => {
    expect(mealIdFromResponse(response(TAP, { foodLogId: 7 }))).toBe(7);
  });

  it('ignores other actions, other notifications and bad data', () => {
    expect(mealIdFromResponse(response('some.other.action', { foodLogId: 7 }))).toBeNull();
    expect(mealIdFromResponse(response(TAP, {}))).toBeNull();
    expect(mealIdFromResponse(response(TAP))).toBeNull();
    expect(mealIdFromResponse(response(TAP, { foodLogId: '7' }))).toBeNull();
    expect(mealIdFromResponse(response(TAP, { foodLogId: 7.5 }))).toBeNull();
  });
});
