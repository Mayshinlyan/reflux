import { act, fireEvent, render, screen } from '@testing-library/react-native';

import WelcomeScreen from '@/app/welcome';

const mockUpdate = jest.fn();
const mockReplace = jest.fn();
const mockSignIn = jest.fn(() => Promise.resolve());

jest.mock('@/db/DatabaseProvider', () => ({
  useSettings: () => ({ settings: {}, update: mockUpdate }),
}));
jest.mock('@/services/firebase', () => ({ ensureAnonymousSession: () => mockSignIn() }));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  router: { replace: (href: string) => mockReplace(href), back: jest.fn(), canGoBack: () => true },
}));

beforeEach(() => {
  mockUpdate.mockReset();
  mockReplace.mockReset();
  mockSignIn.mockClear();
});

const press = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));

describe('Welcome', () => {
  it('starts on the greeting with no back button, step 1 of 2, and the tracking-only note', async () => {
    await render(<WelcomeScreen />);

    expect(screen.getByRole('header', { name: "Let's see how your belly feels." })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.getByRole('progressbar', { name: 'Step 1 of 2' })).toBeTruthy();
    expect(screen.getByText(/not medical advice/)).toBeTruthy();
  });

  it('introduces Bellie on the second step, and Back returns to the greeting', async () => {
    await render(<WelcomeScreen />);
    await press('Get started');

    expect(screen.getByText("Hi there! I'm Bellie!")).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Step 2 of 2' })).toBeTruthy();

    await press('Back');
    expect(screen.getByRole('header', { name: "Let's see how your belly feels." })).toBeTruthy();
  });

  it('ends on a celebration without dots, and only Start logging finishes onboarding', async () => {
    await render(<WelcomeScreen />);
    await press('Get started');
    await press('Continue');

    expect(screen.getByText('Ready when you are!')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();

    await press('Start logging');
    await act(async () => {});

    expect(mockUpdate).toHaveBeenCalledWith('onboardingDone', true);
    expect(mockSignIn).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
