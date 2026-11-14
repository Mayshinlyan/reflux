import {
  daysUntil,
  isItemKey,
  isOwned,
  isValidWorn,
  ITEM_KEYS,
  ITEM_SPOT,
  ITEM_UNLOCK_DAY,
  moreDays,
  nextLocked,
  ownedCount,
  takeOff,
  unlockLine,
  wearItem,
  wornNow,
} from '../bellieItems';

describe('unlocking', () => {
  it('unlocks one item after another as the check-in days climb', () => {
    expect([0, 2].map(ownedCount)).toEqual([0, 0]);
    expect(ownedCount(3)).toBe(1);
    expect(ownedCount(7)).toBe(2);
    expect(ownedCount(50)).toBe(ITEM_KEYS.length);
    expect(isOwned('scarf', 29)).toBe(false);
    expect(isOwned('scarf', 30)).toBe(true);
  });

  it('counts the days left, never below zero', () => {
    expect(daysUntil('shades', 7)).toBe(7);
    expect(daysUntil('shades', 14)).toBe(0);
    expect(daysUntil('shades', 400)).toBe(0);
  });

  it('unlocks in the planned order: glasses, bow tie, hat, sunglasses, headphones, scarf, nightcap, chef hat', () => {
    const order = [...ITEM_KEYS].sort((a, b) => ITEM_UNLOCK_DAY[a] - ITEM_UNLOCK_DAY[b]);
    expect(order).toEqual(['glasses', 'bow', 'hat', 'shades', 'phones', 'scarf', 'night', 'chef']);
    expect(order.map((key) => ITEM_UNLOCK_DAY[key])).toEqual([3, 7, 10, 14, 21, 30, 45, 50]);
  });

  it('says what is left in words, and which item is next', () => {
    expect(moreDays(1)).toBe('1 more day');
    expect(moreDays(4)).toBe('4 more days');
    expect(unlockLine(4)).toBe('Unlock after 4 more days of check-in');
    expect(unlockLine(1, true)).toBe('Next gift: unlock after 1 more day of check-in');
    expect(nextLocked(0)).toBe('glasses');
    expect(nextLocked(12)).toBe('shades');
    expect(nextLocked(50)).toBeNull();
  });

  it('has the ladder spread out: each item later than the one before it, in unlock order', () => {
    const days = [...ITEM_KEYS].map((key) => ITEM_UNLOCK_DAY[key]).sort((a, b) => a - b);
    expect(new Set(days).size).toBe(ITEM_KEYS.length);
  });
});

describe('wearing', () => {
  it('stacks items in different spots', () => {
    const worn = wearItem(wearItem(wearItem([], 'hat'), 'glasses'), 'scarf');
    expect(worn).toEqual(['hat', 'glasses', 'scarf']);
  });

  it('swaps what shared the spot: a chef hat takes the hat off, sunglasses the round glasses, a bow tie the scarf', () => {
    expect(wearItem(['hat', 'scarf'], 'chef')).toEqual(['chef', 'scarf']);
    expect(wearItem(['glasses'], 'shades')).toEqual(['shades']);
    expect(wearItem(['scarf', 'phones'], 'bow')).toEqual(['phones', 'bow']);
  });

  it('wears the headphones with every hat', () => {
    expect(wearItem(wearItem([], 'night'), 'phones')).toEqual(['night', 'phones']);
    expect(wearItem(['phones'], 'hat')).toEqual(['hat', 'phones']);
  });

  it('keeps the order from the head down, and takes an item off', () => {
    expect(wearItem(['scarf'], 'hat')).toEqual(['hat', 'scarf']);
    expect(takeOff(['hat', 'glasses'], 'hat')).toEqual(['glasses']);
    expect(takeOff(['hat'], 'bow')).toEqual(['hat']);
  });

  it('never has two in one spot after wearing', () => {
    for (const first of ITEM_KEYS) {
      for (const second of ITEM_KEYS) {
        const worn = wearItem(wearItem([], first), second);
        const spots = worn.map((key) => ITEM_SPOT[key]);
        expect(new Set(spots).size).toBe(spots.length);
      }
    }
  });
});

describe('saved lists', () => {
  it('accepts items one per spot and refuses the rest', () => {
    expect(isValidWorn([])).toBe(true);
    expect(isValidWorn(['hat', 'glasses'])).toBe(true);
    expect(isValidWorn(['hat', 'chef'])).toBe(false); // both the head
    expect(isValidWorn(['hat', 'hat'])).toBe(false);
    expect(isValidWorn(['cape'])).toBe(false);
    expect(isValidWorn('hat')).toBe(false);
    expect(isItemKey('hat')).toBe(true);
    expect(isItemKey('cape')).toBe(false);
  });

  it('still wears a hat that was saved as the old yes-or-no, until a list is saved', () => {
    expect(wornNow([], true)).toEqual(['hat']);
    expect(wornNow(['glasses'], true)).toEqual(['glasses']);
    expect(wornNow([], false)).toEqual([]);
    expect(wornNow('nonsense', false)).toEqual([]);
  });
});
