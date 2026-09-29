import * as Sentry from '@sentry/react-native';

import { scrubBreadcrumb, scrubEvent } from './sentryScrubber';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** JS-error reporting only in the MVP (Expo Go). Native crashes arrive with EAS in M2. */
export function initSentry() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableAutoSessionTracking: false,
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  });
}

/** Wraps the root component with Sentry only when Sentry is actually enabled. */
export function wrapRoot<P extends Record<string, unknown>>(component: React.ComponentType<P>) {
  return dsn ? Sentry.wrap(component) : component;
}

export { Sentry };
