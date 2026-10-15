/** Most saved foods the medium widget has room for. */
export const WIDGET_FOOD_COUNT = 3;

export type WidgetFood = { id: number; name: string };

/**
 * Where the widget's "Snap food" bubble goes: straight to the camera. The widget file can't import this (it runs
 * in its own isolated runtime), so it spells the same link out; a test keeps the two in step.
 */
export const SNAP_FOOD_LINK = 'adayinmybelly://log/food?camera=1';

/** The link under a saved-food pill: logs that food at once, and carries the widget's token. */
export const quickLogLink = (id: number, token: string) =>
  `adayinmybelly://log/food?quickLog=${id}&t=${token}`;

/** The saved foods the widget shows: the first few, with a name that fits a pill. */
export function pickWidgetFoods(foods: { id: number; mealName: string }[]): WidgetFood[] {
  return foods.slice(0, WIDGET_FOOD_COUNT).map(({ id, mealName }) => ({ id, name: mealName }));
}

/**
 * A link can open the app from anywhere (a web page, a message), so a link that logs a meal must prove it came
 * from the widget: the token is made on this phone, only ever written to the widget, and has to match.
 */
export function isQuickLogAllowed(given: string | undefined, stored: string): boolean {
  return stored.length > 0 && given === stored;
}

/** A fresh random token (32 hex characters). `random` is for tests. */
export function newWidgetToken(random: () => number = Math.random): string {
  const bytes = new Uint8Array(16);
  const secure = globalThis.crypto?.getRandomValues?.bind(globalThis.crypto);
  if (secure) secure(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(random() * 256);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
