/**
 * Public client configuration, read from EXPO_PUBLIC_* env vars (inlined by Metro at build
 * time). None of these are secrets: the Firebase web config only identifies the project and
 * the relay verifies every request itself. See .env.example.
 */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
  return value;
}

export function relayBaseUrl(): string {
  // Static property access: Metro only inlines `process.env.EXPO_PUBLIC_X`, not dynamic lookups.
  return required('EXPO_PUBLIC_RELAY_URL', process.env.EXPO_PUBLIC_RELAY_URL).replace(/\/+$/, '');
}

export function firebaseConfig() {
  return {
    apiKey: required('EXPO_PUBLIC_FIREBASE_API_KEY', process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: required('EXPO_PUBLIC_FIREBASE_PROJECT_ID', process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };
}
