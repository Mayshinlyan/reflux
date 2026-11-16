import { act, render } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import { cancelWeeklyReport, scheduleWeeklyReport } from '@/services/reminders';

import { CheckInRouter } from '../CheckInRouter';

const mockPush = jest.fn();
const mockSettings: { checkInReminderMinutes: number | null } = { checkInReminderMinutes: 120 };
jest.mock('expo-router', () => ({ router: { push: (href: unknown) => mockPush(href) } }));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('@/db/DatabaseProvider', () => ({ useSettings: () => ({ settings: mockSettings }) }));
jest.mock('@/services/reminders', () => ({
  ...jest.requireActual('@/services/reminders'),
  scheduleWeeklyReport: jest.fn(() => Promise.resolve('scheduled')),
  cancelWeeklyReport: jest.fn(() => Promise.resolve()),
}));

const mocked = jest.mocked(Notifications);
const TAP = 'expo.modules.notifications.actions.DEFAULT';

const reminder = (actionIdentifier: string, data: Record<string, unknown>) =>
  ({
    actionIdentifier,
    notification: { date: 1, request: { identifier: 'meal-7', content: { data } } },
  }) as never;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

describe('CheckInRouter', () => {
  it('opens the symptom check-in for the meal when its reminder is tapped, once', async () => {
    mocked.useLastNotificationResponse.mockReturnValue(reminder(TAP, { foodLogId: 7 }));

    const { rerender } = await render(<CheckInRouter />);
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    await rerender(<CheckInRouter />);
    await act(async () => {
      jest.advanceTimersByTime(10);
    });

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/log/symptoms', params: { afterFood: '7' } });
    // Cleared, so remounting the app root doesn't open it again.
    expect(mocked.clearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the app was not opened from a notification', async () => {
    mocked.useLastNotificationResponse.mockReturnValue(null);

    await render(<CheckInRouter />);
    await act(async () => {
      jest.advanceTimersByTime(10);
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(mocked.clearLastNotificationResponseAsync).not.toHaveBeenCalled();
  });

  it('ignores an action button and a notification that is not a reminder', async () => {
    mocked.useLastNotificationResponse.mockReturnValue(reminder('some.other.action', { foodLogId: 7 }));
    await render(<CheckInRouter />);
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('opens "Your week with Bellie" when the Sunday notification is tapped, and not for another action', async () => {
    mocked.useLastNotificationResponse.mockReturnValue(reminder(TAP, { report: true }));
    await render(<CheckInRouter />);
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/weekly-report');

    mockPush.mockClear();
    // A different notification date, so it is not skipped as the one already handled.
    mocked.useLastNotificationResponse.mockReturnValue({
      actionIdentifier: 'some.other.action',
      notification: {
        date: 2,
        request: { identifier: 'weekly-report', content: { data: { report: true } } },
      },
    } as never);
    await render(<CheckInRouter />);
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('CheckInRouter: the week plan notification', () => {
  it('opens the new plan when "Your week is ready" is tapped', async () => {
    mocked.useLastNotificationResponse.mockReturnValue(reminder(TAP, { plan: true }));
    await render(<CheckInRouter />);
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/plan');
  });
});

describe('CheckInRouter: the weekly notification', () => {
  beforeEach(() => {
    mocked.useLastNotificationResponse.mockReturnValue(null);
  });

  it('keeps it scheduled while check-in reminders are on', async () => {
    mockSettings.checkInReminderMinutes = 120;
    await render(<CheckInRouter />);

    expect(scheduleWeeklyReport).toHaveBeenCalledTimes(1);
    expect(cancelWeeklyReport).not.toHaveBeenCalled();
  });

  it('drops it when check-in reminders are off', async () => {
    mockSettings.checkInReminderMinutes = null;
    await render(<CheckInRouter />);

    expect(cancelWeeklyReport).toHaveBeenCalledTimes(1);
    expect(scheduleWeeklyReport).not.toHaveBeenCalled();
  });
});
