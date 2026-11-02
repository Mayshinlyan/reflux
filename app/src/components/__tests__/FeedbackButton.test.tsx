import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { FeedbackButton, feedbackButtonClearance } from '../FeedbackButton';
import { tabBarHeight } from '../FloatingTabBar';

const mockSendFeedback = jest.fn();
jest.mock('@/services/relayClient', () => ({ sendFeedback: (message: string) => mockSendFeedback(message) }));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
const mockToast = jest.fn();
jest.mock('../Toast', () => ({ useToast: () => mockToast }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));

const PLACEHOLDER = "What's working? What could be better?";

beforeEach(() => {
  mockSendFeedback.mockReset();
  mockToast.mockReset();
});

describe('FeedbackButton', () => {
  it('shows a Feedback pill and keeps the sheet closed until it is pressed', async () => {
    await render(<FeedbackButton />);

    expect(screen.getByRole('button', { name: 'Feedback' })).toBeTruthy();
    expect(screen.getByText('Feedback')).toBeTruthy();
    expect(screen.queryByRole('header', { name: 'Tell us what you think' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Feedback' }));

    expect(screen.getByRole('header', { name: 'Tell us what you think' })).toBeTruthy();
  });

  it('sends the message, then closes with a thank-you toast and a success haptic', async () => {
    mockSendFeedback.mockResolvedValue(undefined);
    const haptic = jest.spyOn(Haptics, 'notificationAsync').mockResolvedValue();
    await render(<FeedbackButton />);

    await fireEvent.press(screen.getByRole('button', { name: 'Feedback' }));
    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), 'Love it');
    await fireEvent.press(screen.getByRole('button', { name: /^Send$/ }));

    expect(mockSendFeedback).toHaveBeenCalledWith('Love it');
    expect(mockToast).toHaveBeenCalledWith('Thanks, Bellie got it');
    expect(haptic).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    expect(screen.queryByRole('header', { name: 'Tell us what you think' })).toBeNull();
  });
});

describe('feedbackButtonClearance', () => {
  it('leaves room for the whole pill above the tab bar, so a list under it can scroll clear', () => {
    // Over the bar by 8, 36 tall, and 8 more to breathe.
    expect(feedbackButtonClearance(0)).toBe(tabBarHeight(0) + 8 + 36 + 8);
  });
});
