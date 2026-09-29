import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

/** Verifies a Firebase ID token and returns the user's uid, or throws. Tests inject a fake. */
export interface TokenVerifier {
  verify(idToken: string): Promise<{ uid: string }>;
}

/** Uses Application Default Credentials (the Cloud Run service account); no key file is ever needed. */
export function createFirebaseTokenVerifier(projectId?: string): TokenVerifier {
  const app = initializeApp(projectId ? { projectId } : undefined);
  const auth = getAuth(app);
  return {
    async verify(idToken) {
      const decoded = await auth.verifyIdToken(idToken);
      return { uid: decoded.uid };
    },
  };
}
