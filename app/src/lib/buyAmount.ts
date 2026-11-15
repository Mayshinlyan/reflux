/**
 * What to put on a shopping list for an ingredient: something that can be bought, not what the recipe uses. A recipe
 * says "2 tbsp cilantro" or "3 tbsp + 1 tsp fish sauce"; the shop sells a bunch and a bottle.
 */

/** What the dishes need of one ingredient, added up by kind. */
export type Need = {
  /** Volume, in cups (spoons and millilitres converted). */
  cups: number;
  /** Weight, in ounces (pounds, grams and kilograms converted). */
  ounces: number;
  /** Counted things ("4 carrots"). */
  count: number;
  /** Things with their own unit ("2 cans", "6 cloves", "1 bunch"), by unit. */
  named: Record<string, number>;
};

/** Rounds away the noise of unit conversions (1/48 of a cup added three times) before counting up. */
const clean = (n: number) => Math.round(n * 1e6) / 1e6;

const TO_CUPS: Record<string, number> = { cup: 1, tbsp: 1 / 16, tsp: 1 / 48, ml: 1 / 240 };
const TO_OUNCES: Record<string, number> = { oz: 1, lb: 16, g: 1 / 28.35, kg: 35.27 };

/** Adds up `unit -> quantity` into volume, weight, count and named units. */
export function needOf(amounts: ReadonlyMap<string | null, number>): Need {
  const need: Need = { cups: 0, ounces: 0, count: 0, named: {} };
  for (const [unit, qty] of amounts) {
    if (unit === null) need.count += qty;
    else if (unit in TO_CUPS) need.cups += qty * TO_CUPS[unit]!;
    else if (unit in TO_OUNCES) need.ounces += qty * TO_OUNCES[unit]!;
    else need.named[unit] = (need.named[unit] ?? 0) + qty;
  }
  need.cups = clean(need.cups);
  need.ounces = clean(need.ounces);
  return need;
}

const HERBS = [
  'cilantro',
  'parsley',
  'basil',
  'mint',
  'dill',
  'chive',
  'thyme',
  'rosemary',
  'sage',
  'tarragon',
  'scallion',
  'green onion',
  'lemongrass',
];
const SPICES = [
  'cumin',
  'paprika',
  'cinnamon',
  'turmeric',
  'oregano',
  'chili flake',
  'pepper flake',
  'cayenne',
  'nutmeg',
  'coriander',
  'curry',
  'garam masala',
  'seasoning',
  'spice',
  'allspice',
  'sesame seed',
  'bay leaf',
  'five spice',
  'powder',
];
const BOTTLES = ['aminos', 'sauce', 'oil', 'vinegar', 'syrup', 'wine', 'extract', 'mirin', 'sake', 'juice'];
const JARS = [
  'hummus',
  'paste',
  'miso',
  'honey',
  'jam',
  'mustard',
  'mayo',
  'mayonnaise',
  'peanut butter',
  'tahini',
  'gochujang',
  'kimchi',
  'salsa',
  'pickle',
  'sambal',
  'ketchup',
  'nut butter',
  'almond butter',
];
const CARTONS = ['broth', 'stock', 'milk', 'cream'];
const BAGS = [
  'rice',
  'flour',
  'sugar',
  'oat',
  'quinoa',
  'lentil',
  'couscous',
  'barley',
  'cornstarch',
  'panko',
];
const PACKS = ['butter', 'cheese', 'bacon'];

const plural = (n: number, word: string, many: string = `${word}s`) => `${n} ${n === 1 ? word : many}`;

/** Weight rounded up to the half pound: "2 lb", "1.5 lb"; under a pound, whole ounces. */
function weight(ounces: number): string {
  if (ounces < 16) return `${Math.ceil(ounces)} oz`;
  const lb = Math.ceil(ounces / 8) / 2;
  return `${lb} lb`;
}

/**
 * The amount to buy. `has` says whether the ingredient's name holds any of some words ("fish sauce" holds "sauce").
 * Nothing quantified (a pinch, "to taste") gives an empty string.
 */
export function buyAmount(has: (words: readonly string[]) => boolean, need: Need): string {
  const { cups, ounces, count, named } = need;
  const any = cups > 0 || ounces > 0 || count > 0 || Object.keys(named).length > 0;
  if (!any) return '';

  // Dried or jarred forms first: "garlic powder" and "ginger paste" are not a head or a piece.
  if (has(SPICES) || has(['paste']) || (has(['ground']) && has(['ginger', 'garlic']))) return '1 jar';
  if (has(['noodle', 'pasta']) || (has(['spaghetti']) && !has(['sauce', 'squash']))) return '1 pack';
  if (has(['ginger'])) return '1 piece';
  if (has(['garlic'])) {
    const cloves = (named.clove ?? 0) + count + (cups * 48) / 3;
    return plural(Math.max(1, Math.ceil(cloves / 10) + Math.ceil(named.head ?? 0)), 'head');
  }
  if (has(HERBS)) return plural(Math.max(1, Math.ceil(named.bunch ?? 0)), 'bunch', 'bunches');
  if (has(['egg']) && !has(['plant', 'nog'])) return plural(Math.max(1, Math.ceil(count / 12)), 'dozen');
  if (has(['tofu'])) return plural(Math.max(1, Math.ceil(ounces / 14 || count)), 'block');
  if (has(['bread'])) return '1 loaf';
  if (has(['lemon', 'lime', 'orange']) && !has(['juice']) && cups > 0 && count === 0) return '1';

  if (named.can) return plural(Math.ceil(named.can), 'can');
  if (has(['coconut milk'])) return plural(Math.max(1, Math.ceil(cups / 1.75)), 'can');
  if (has(['yogurt', 'yoghurt', 'kefir'])) return plural(Math.max(1, Math.ceil(cups / 2)), 'tub');
  if (has(['cheese'])) return '1 pack';
  if (has(CARTONS)) return plural(Math.max(1, Math.ceil(cups / 4)), 'carton');
  if (has(BOTTLES)) return plural(Math.max(1, Math.ceil(cups / 2)), 'bottle');
  if (has(JARS)) return '1 jar';
  if (has(PACKS)) return '1 pack';
  if (has(BAGS)) return '1 bag';

  // Things sold by weight or by the piece: meat, fish, produce.
  if (ounces > 0) return weight(ounces);
  const pieces = count + Object.entries(named).reduce((sum, [, qty]) => sum + qty, 0);
  if (pieces > 0) return String(Math.ceil(pieces));
  // Only measured by volume (cups of chopped cabbage, a spoon of something): a unit or two of the thing.
  return String(Math.max(1, Math.ceil(cups / 2)));
}
