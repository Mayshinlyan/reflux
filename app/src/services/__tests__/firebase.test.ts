import { signInAnonymously } from 'firebase/auth';

import { ensureAnonymousSession } from '../firebase';

const mockAuth = {
  currentUser: null as object | null,
  authStateReady: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@react-native-async-storage/async-storage', () => ({}));
jest.mock('firebase/app', () => ({ getApps: () => [{}], getApp: () => ({}), initializeApp: jest.fn() }));
jest.mock('firebase/auth', () => ({
  getAuth: () => mockAuth,
  initializeAuth: jest.fn(),
  getReactNativePersistence: jest.fn(),
  signInAnonymously: jest.fn(),
}));

const signIn = signInAnonymously as jest.Mock;

beforeEach(() => {
  mockAuth.currentUser = null;
  signIn.mockReset().mockImplementation(async () => {
    mockAuth.currentUser = { uid: 'u' };
  });
});

describe('ensureAnonymousSession', () => {
  it('signs in once for concurrent callers', async () => {
    await Promise.all([ensureAnonymousSession(), ensureAnonymousSession()]);
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('skips sign-in when a session already exists', async () => {
    mockAuth.currentUser = { uid: 'u' };
    await ensureAnonymousSession();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('maps failures to AUTH_FAILED and allows a retry', async () => {
    signIn.mockRejectedValueOnce(new Error('network'));
    await expect(ensureAnonymousSession()).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    await expect(ensureAnonymousSession()).resolves.toBeUndefined();
  });
});
