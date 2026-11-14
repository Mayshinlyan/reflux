/**
 * What Bellie can wear (Figma "Belly items" and G12). Items unlock with check-in days and stack on Bellie, one per
 * spot: the hat, chef hat and nightcap are all the head, the round glasses and sunglasses the face, the scarf and bow
 * tie the neck. The headphones sit on the ears and go with everything.
 */
export const ITEM_KEYS = ['hat', 'chef', 'night', 'phones', 'glasses', 'shades', 'bow', 'scarf'] as const;
export type ItemKey = (typeof ITEM_KEYS)[number];

export type Spot = 'head' | 'ears' | 'face' | 'neck';

export const ITEM_SPOT: Record<ItemKey, Spot> = {
  hat: 'head',
  chef: 'head',
  night: 'head',
  phones: 'ears',
  glasses: 'face',
  shades: 'face',
  bow: 'neck',
  scarf: 'neck',
};

/** The check-in day each item unlocks on. */
export const ITEM_UNLOCK_DAY: Record<ItemKey, number> = {
  glasses: 3,
  bow: 7,
  hat: 10,
  shades: 14,
  phones: 21,
  scarf: 30,
  night: 45,
  chef: 50,
};

/** The line on an item's gift page (Figma G4). */
export const ITEM_GIFT_TITLE: Record<ItemKey, string> = {
  hat: 'A little hat for Bellie',
  chef: 'A chef hat for Bellie',
  night: 'A nightcap for Bellie',
  phones: 'Headphones for Bellie',
  glasses: 'Round glasses for Bellie',
  shades: 'Sunglasses for Bellie',
  bow: 'A bow tie for Bellie',
  scarf: 'A cozy scarf for Bellie',
};

export const ITEM_NAME: Record<ItemKey, string> = {
  hat: 'Little hat',
  chef: 'Chef hat',
  night: 'Nightcap',
  phones: 'Headphones',
  glasses: 'Round glasses',
  shades: 'Sunglasses',
  bow: 'Bow tie',
  scarf: 'Scarf',
};

export function isItemKey(value: unknown): value is ItemKey {
  return typeof value === 'string' && (ITEM_KEYS as readonly string[]).includes(value);
}

export function isOwned(key: ItemKey, checkInDays: number): boolean {
  return checkInDays >= ITEM_UNLOCK_DAY[key];
}

/** How many more check-in days until an item unlocks (0 once it is owned). */
export function daysUntil(key: ItemKey, checkInDays: number): number {
  return Math.max(0, ITEM_UNLOCK_DAY[key] - checkInDays);
}

/** "4 more days", "1 more day": what a locked item says on its tile. */
export function moreDays(days: number): string {
  return `${days} more ${days === 1 ? 'day' : 'days'}`;
}

/** "Unlock after 4 more days of check-in": the line under the row for a locked item. */
export function unlockLine(days: number): string {
  return `Unlock after ${moreDays(days)} of check-in`;
}

/** The item that unlocks soonest, or null once everything is owned. */
export function nextLocked(checkInDays: number): ItemKey | null {
  const locked = ITEM_KEYS.filter((key) => !isOwned(key, checkInDays));
  locked.sort((a, b) => ITEM_UNLOCK_DAY[a] - ITEM_UNLOCK_DAY[b]);
  return locked[0] ?? null;
}

export function ownedCount(checkInDays: number): number {
  return ITEM_KEYS.filter((key) => isOwned(key, checkInDays)).length;
}

/** Puts an item on. Whatever was in its spot comes off, and the list stays in the order of `ITEM_KEYS`. */
export function wearItem(worn: readonly ItemKey[], key: ItemKey): ItemKey[] {
  const kept = worn.filter((other) => other !== key && ITEM_SPOT[other] !== ITEM_SPOT[key]);
  return ITEM_KEYS.filter((other) => other === key || kept.includes(other));
}

export function takeOff(worn: readonly ItemKey[], key: ItemKey): ItemKey[] {
  return worn.filter((other) => other !== key);
}

/** A saved list is good when every entry is an item, none twice, and no two share a spot. */
export function isValidWorn(value: unknown): value is ItemKey[] {
  if (!Array.isArray(value) || !value.every(isItemKey)) return false;
  const spots = value.map((key) => ITEM_SPOT[key]);
  return new Set(value).size === value.length && new Set(spots).size === spots.length;
}

/**
 * What Bellie wears now. Before the dress-up page the hat was a yes or no (`bellieHat`); one saved that way still
 * wears it until a list is saved.
 */
export function wornNow(worn: unknown, legacyHat: boolean): ItemKey[] {
  if (isValidWorn(worn) && (worn.length > 0 || !legacyHat)) return worn;
  return legacyHat ? ['hat'] : [];
}
