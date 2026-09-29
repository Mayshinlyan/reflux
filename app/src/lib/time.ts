/** Current time as an ISO-8601 UTC string, the format every `*_at` column uses. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** The device's IANA time zone (e.g. "Europe/London"), stored alongside each log. */
export function currentTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
