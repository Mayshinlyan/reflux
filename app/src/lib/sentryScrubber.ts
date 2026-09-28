/**
 * Privacy scrubber for Sentry events. Health data must never leave the device, so
 * this keeps only what's needed to debug: the error type/message, the stack, the
 * operation name and error code tags, and the relay request ID.
 *
 * Kept free of Sentry imports so it can be unit-tested in isolation.
 */

type Breadcrumb = { category?: string; type?: string; message?: string; data?: Record<string, unknown> };

export type ScrubbableEvent = {
  message?: unknown;
  request?: unknown;
  user?: unknown;
  extra?: unknown;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  breadcrumbs?: Breadcrumb[];
};

/** Tags we set ourselves and allow through; everything else is dropped. */
const ALLOWED_TAGS = new Set(['operation', 'code', 'requestId']);
/** Device/runtime contexts that contain no user content. */
const ALLOWED_CONTEXTS = new Set(['os', 'device', 'app', 'runtime', 'react_native_context']);
/** Breadcrumb categories that carry app content (console args, UI text, request bodies). */
const DROPPED_BREADCRUMB_CATEGORIES = new Set(['console', 'ui.click', 'ui.input', 'touch', 'xhr', 'fetch']);

export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  const scrubbed: T = { ...event };
  delete scrubbed.request;
  delete scrubbed.user;
  delete scrubbed.extra;

  if (scrubbed.tags) {
    scrubbed.tags = Object.fromEntries(
      Object.entries(scrubbed.tags).filter(([key]) => ALLOWED_TAGS.has(key)),
    );
  }
  if (scrubbed.contexts) {
    scrubbed.contexts = Object.fromEntries(
      Object.entries(scrubbed.contexts).filter(([key]) => ALLOWED_CONTEXTS.has(key)),
    );
  }
  if (scrubbed.breadcrumbs) {
    scrubbed.breadcrumbs = scrubbed.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((b): b is Breadcrumb => b !== null);
  }
  return scrubbed;
}

export function scrubBreadcrumb<T extends Breadcrumb>(breadcrumb: T): T | null {
  if (breadcrumb.category && DROPPED_BREADCRUMB_CATEGORIES.has(breadcrumb.category)) return null;
  // Navigation breadcrumbs keep route names only (no params — ids could be meaningful).
  const { data: _data, ...rest } = breadcrumb;
  return rest as T;
}
