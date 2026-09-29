import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  type Auth,
  getAuth,
  // Exported by the React Native build of firebase/auth but missing from its default typings.
  // @ts-expect-error TS2305
  getReactNativePersistence,
  initializeAuth,
  signInAnonymously,
} from 'firebase/auth';

import { firebaseConfig } from '@/lib/config';
import { AppError } from '@/lib/errors';

let auth: Auth | undefined;

function getFirebaseAuth(): Auth {
  if (auth) return auth;
  if (getApps().length > 0) {
    auth = getAuth(getApp());
  } else {
    const app = initializeApp(firebaseConfig());
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  }
  return auth;
}

let signingIn: Promise<void> | undefined;

/**
 * Ensures an anonymous session exists (persisted across launches). Used only for relay rate
 * limiting. Concurrent callers share one attempt so we never create two anonymous users.
 */
export function ensureAnonymousSession(): Promise<void> {
  signingIn ??= (async () => {
    try {
      const instance = getFirebaseAuth();
      await instance.authStateReady();
      if (!instance.currentUser) await signInAnonymously(instance);
    } catch {
      throw new AppError('AUTH_FAILED');
    }
  })().finally(() => {
    signingIn = undefined;
  });
  return signingIn;
}

/** A fresh ID token (the SDK refreshes it when close to expiry). Signs in first if needed. */
export async function getIdToken(): Promise<string> {
  await ensureAnonymousSession();
  try {
    const user = getFirebaseAuth().currentUser;
    if (!user) throw new Error('signed out');
    return await user.getIdToken();
  } catch {
    throw new AppError('AUTH_FAILED');
  }
}
