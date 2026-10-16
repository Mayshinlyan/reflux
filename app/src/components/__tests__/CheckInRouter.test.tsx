import { act, render } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import { CheckInRouter } from '../CheckInRouter';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (href: unknown) => mockPush(href) } }));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));

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
});
