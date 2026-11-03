/** After this many days the Kitchen asks "Update your fridge?" (an inline line, never a notification). */
export const FRIDGE_NUDGE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days since `iso`, never negative; 0 for a time that cannot be read. */
export function daysSince(iso: string, now: Date = new Date()): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now.getTime() - then) / DAY_MS));
}

/** "Updated today", "Updated yesterday", "Updated 3 days ago". */
export function updatedLine(iso: string, now: Date = new Date()): string {
  const days = daysSince(iso, now);
  if (days === 0) return 'Updated today';
  if (days === 1) return 'Updated yesterday';
  return `Updated ${days} days ago`;
}

/** True once the fridge is a week old or more. */
export function fridgeIsStale(iso: string, now: Date = new Date()): boolean {
  return daysSince(iso, now) >= FRIDGE_NUDGE_DAYS;
}

/** "1 item" or "14 items". */
export function itemsLine(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

/** Lowercase, no accents, hyphens as spaces, one space between words. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[-–—_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A fridge name as it may be written in a recipe line: as typed, its singular and the plurals of that. */
function forms(name: string): string[] {
  const typed = normalize(name);
  let singular = typed;
  if (typed.length > 4 && typed.endsWith('ies')) singular = `${typed.slice(0, -3)}y`;
  else if (/(oes|ches|shes|xes|sses)$/.test(typed)) singular = typed.slice(0, -2);
  else if (typed.length >= 3 && typed.endsWith('s') && !/(ss|us|is)$/.test(typed))
    singular = typed.slice(0, -1);
  const all = new Set([typed, singular, `${singular}s`, `${singular}es`]);
  if (singular.endsWith('y')) all.add(`${singular.slice(0, -1)}ies`);
  return [...all].filter((form) => form.length >= 3);
}

/**
 * Whether a recipe's ingredient line ("2 eggs", "1/2 cup kimchi, rinsed") names something in the fridge. It matches
 * whole words only, so "rice" is found in "1 1/2 cups cooked rice" but not in "licorice".
 */
export function inFridge(line: string, fridge: readonly string[]): boolean {
  const text = normalize(line);
  return fridge.some((name) =>
    forms(name).some((form) => new RegExp(`(^|[^a-z])${escape(form)}([^a-z]|$)`).test(text)),
  );
}

/** How many of a recipe's ingredient lines the fridge already covers. */
export function countInFridge(lines: readonly string[], fridge: readonly string[]): number {
  return lines.filter((line) => inFridge(line, fridge)).length;
}
