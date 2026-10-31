import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { AppError } from '@/lib/errors';

import { FeedbackSheet } from '../FeedbackSheet';

const mockSendFeedback = jest.fn();
jest.mock('@/services/relayClient', () => ({ sendFeedback: (message: string) => mockSendFeedback(message) }));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const PLACEHOLDER = "What's working? What could be better?";

beforeEach(() => mockSendFeedback.mockReset());

const type = (text: string) => fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), text);
const send = () => fireEvent.press(screen.getByRole('button', { name: /^Send/ }));
const sendButton = () => screen.getByRole('button', { name: /^Send/ });

describe('FeedbackSheet', () => {
  it('says what is sent, and keeps Send muted until something is typed', async () => {
    await render(<FeedbackSheet visible onClose={jest.fn()} onSent={jest.fn()} />);

    expect(screen.getByRole('header', { name: 'Send feedback' })).toBeTruthy();
    expect(screen.getByText('Only what you write here is sent. No meals or symptoms.')).toBeTruthy();
    expect(sendButton().props.accessibilityState).toMatchObject({ disabled: true });

    await type('   ');
    expect(sendButton().props.accessibilityState).toMatchObject({ disabled: true });

    await type('Hello');
    expect(sendButton().props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('sends the trimmed text, clears the field and reports it was sent', async () => {
    mockSendFeedback.mockResolvedValue(undefined);
    const onSent = jest.fn();
    await render(<FeedbackSheet visible onClose={jest.fn()} onSent={onSent} />);

    await type('  Love the summaries  ');
    await send();

    expect(mockSendFeedback).toHaveBeenCalledWith('Love the summaries');
    expect(onSent).toHaveBeenCalledTimes(1);
    expect(screen.getByPlaceholderText(PLACEHOLDER).props.value).toBe('');
  });

  it('sends once even if Send is pressed again while it is sending', async () => {
    let finish: () => void = () => {};
    mockSendFeedback.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    await render(<FeedbackSheet visible onClose={jest.fn()} onSent={jest.fn()} />);

    await type('Hello');
    await send();
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeTruthy();
    await send();
    await act(async () => finish());

    expect(mockSendFeedback).toHaveBeenCalledTimes(1);
  });

  it.each([
    [new AppError('RATE_LIMITED'), "You've sent a lot of feedback today. Please try again tomorrow."],
    [new AppError('OFFLINE'), 'Sending feedback needs an internet connection.'],
    [new AppError('NETWORK'), 'Sending feedback needs an internet connection.'],
    [new AppError('INPUT_REJECTED'), "We couldn't send that. Please try again."],
    [new Error('anything else'), "We couldn't send that. Please try again."],
  ])('when sending fails it says so plainly and keeps the text (%#)', async (error, words) => {
    mockSendFeedback.mockRejectedValue(error);
    const onSent = jest.fn();
    await render(<FeedbackSheet visible onClose={jest.fn()} onSent={onSent} />);

    await type('Please keep this');
    await send();

    expect(screen.getByText(words)).toBeTruthy();
    expect(screen.getByPlaceholderText(PLACEHOLDER).props.value).toBe('Please keep this');
    expect(onSent).not.toHaveBeenCalled();
    // Send is available again, so it can be retried.
    expect(sendButton().props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('clears the error as soon as the text changes', async () => {
    mockSendFeedback.mockRejectedValue(new AppError('NETWORK'));
    await render(<FeedbackSheet visible onClose={jest.fn()} onSent={jest.fn()} />);

    await type('Hi');
    await send();
    expect(screen.getByText('Sending feedback needs an internet connection.')).toBeTruthy();

    await type('Hi again');
    expect(screen.queryByText('Sending feedback needs an internet connection.')).toBeNull();
  });

  it('stops the text at 2000 characters, the most the relay accepts', async () => {
    await render(<FeedbackSheet visible onClose={jest.fn()} onSent={jest.fn()} />);

    expect(screen.getByPlaceholderText(PLACEHOLDER).props.maxLength).toBe(2000);
  });
});
