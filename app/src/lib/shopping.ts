import type { StoredMeal } from '@/db/repositories/mealPlans';

import { buyAmount, needOf } from './buyAmount';
import { inFridge } from './fridge';
import { eatenMeals } from './prep';

/** Where things are found in a shop, in the order the list shows them. */
export const AISLES = ['Produce', 'Protein', 'Dairy and eggs', 'Pantry', 'Added by you'] as const;
export type Aisle = (typeof AISLES)[number];

export type ShopItem = { key: string; name: string; amount: string };
export type ShoppingList = {
  aisles: { name: Aisle; items: ShopItem[] }[];
  /** What the plan uses that is in the fridge or is a pantry basic: not bought. */
  have: string[];
  /** How many things are left to buy (own items included). */
  toBuy: number;
};

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

/** Unit words and the one they count as. The names are what the amount shows. */
const UNITS: Record<string, { unit: string; plural?: string }> = {
  cup: { unit: 'cup', plural: 'cups' },
  cups: { unit: 'cup', plural: 'cups' },
  tbsp: { unit: 'tbsp' },
  tablespoon: { unit: 'tbsp' },
  tablespoons: { unit: 'tbsp' },
  tsp: { unit: 'tsp' },
  teaspoon: { unit: 'tsp' },
  teaspoons: { unit: 'tsp' },
  lb: { unit: 'lb' },
  lbs: { unit: 'lb' },
  pound: { unit: 'lb' },
  pounds: { unit: 'lb' },
  oz: { unit: 'oz' },
  ounce: { unit: 'oz' },
  ounces: { unit: 'oz' },
  g: { unit: 'g' },
  gram: { unit: 'g' },
  grams: { unit: 'g' },
  kg: { unit: 'kg' },
  ml: { unit: 'ml' },
  can: { unit: 'can', plural: 'cans' },
  cans: { unit: 'can', plural: 'cans' },
  clove: { unit: 'clove', plural: 'cloves' },
  cloves: { unit: 'clove', plural: 'cloves' },
  bunch: { unit: 'bunch', plural: 'bunches' },
  bunches: { unit: 'bunch', plural: 'bunches' },
  head: { unit: 'head', plural: 'heads' },
  heads: { unit: 'head', plural: 'heads' },
  slice: { unit: 'slice', plural: 'slices' },
  slices: { unit: 'slice', plural: 'slices' },
  stalk: { unit: 'stalk', plural: 'stalks' },
  stalks: { unit: 'stalk', plural: 'stalks' },
  jar: { unit: 'jar', plural: 'jars' },
  bottle: { unit: 'bottle', plural: 'bottles' },
  bag: { unit: 'bag', plural: 'bags' },
  pinch: { unit: 'pinch', plural: 'pinches' },
  inch: { unit: 'inch' },
  pint: { unit: 'pint', plural: 'pints' },
  stick: { unit: 'stick', plural: 'sticks' },
  handful: { unit: 'handful', plural: 'handfuls' },
  sprig: { unit: 'sprig', plural: 'sprigs' },
  sprigs: { unit: 'sprig', plural: 'sprigs' },
  package: { unit: 'package', plural: 'packages' },
  packages: { unit: 'package', plural: 'packages' },
  pkg: { unit: 'package', plural: 'packages' },
  packet: { unit: 'package', plural: 'packages' },
};

/** Words that describe how a thing is cut or cooked, not what it is. */
const DESCRIPTORS = new Set([
  'fresh',
  'large',
  'small',
  'medium',
  'cooked',
  'chopped',
  'diced',
  'minced',
  'sliced',
  'grated',
  'shredded',
  'peeled',
  'boneless',
  'skinless',
  'ripe',
  'whole',
  'thin',
  'thinly',
  'thick',
  'finely',
  'roughly',
  'coarsely',
  'matchstick',
  'matchsticks',
  'julienned',
  'crushed',
  'halved',
  'quartered',
  'trimmed',
  'rinsed',
  'drained',
  'optional',
  'packed',
  'heaping',
  'toasted',
  'piece',
  'pieces',
]);

/** Where the name ends and the cooking instructions begin: "chicken thighs cut into pieces", "butter or oil". */
const NAME_ENDS = /\s(?:into|for|to|plus|about|divided|such)\b.*$/;

/** Pantry basics that are assumed to be at home. */
const STAPLES = new Set([
  'salt',
  'pepper',
  'black pepper',
  'water',
  'oil',
  'olive oil',
  'cooking oil',
  'vegetable oil',
  'salt and pepper',
]);

const PANTRY_WORDS = [
  'broth',
  'stock',
  'sauce',
  'paste',
  'canned',
  'powder',
  'flour',
  'noodle',
  'coconut milk',
];
const PROTEIN = [
  'chicken',
  'beef',
  'pork',
  'turkey',
  'lamb',
  'salmon',
  'cod',
  'fish',
  'shrimp',
  'tuna',
  'tofu',
  'tempeh',
  'fillet',
  'steak',
  'prosciutto',
  'sausage',
  'halibut',
  'tilapia',
  'trout',
];
const DAIRY = ['milk', 'yogurt', 'yoghurt', 'cheese', 'butter', 'egg', 'cream', 'kefir'];
const PRODUCE = [
  'carrot',
  'zucchini',
  'ginger',
  'scallion',
  'spinach',
  'lettuce',
  'tomato',
  'potato',
  'onion',
  'garlic',
  'cucumber',
  'broccoli',
  'cabbage',
  'kale',
  'pumpkin',
  'squash',
  'banana',
  'apple',
  'lemon',
  'lime',
  'avocado',
  'mushroom',
  'celery',
  'bok choy',
  'basil',
  'cilantro',
  'parsley',
  'mint',
  'dill',
  'pear',
  'berry',
  'strawberry',
  'blueberry',
  'raspberry',
  'blackberry',
  'melon',
  'pea',
  'sprout',
  'eggplant',
  'radish',
  'turnip',
  'beet',
  'fennel',
  'leek',
  'chive',
  'bell pepper',
  'green bean',
  'asparagus',
  'cauliflower',
  'mango',
  'papaya',
  'orange',
  'daikon',
  'pineapple',
  'watermelon',
  'cantaloupe',
  'honeydew',
  'arugula',
  'shallot',
  'parsnip',
  'jalapeno',
  'pomegranate',
  'grape',
  'peach',
  'plum',
  'kiwi',
];

type Parsed = { name: string; qty: number | null; unit: string | null };

function readNumber(text: string): { qty: number; rest: string } | null {
  const forms: [RegExp, (m: RegExpExecArray) => number][] = [
    [/^(\d+)\s+(\d+)\/(\d+)/, (m) => Number(m[1]) + Number(m[2]) / Number(m[3])],
    [/^(\d+)\/(\d+)/, (m) => Number(m[1]) / Number(m[2])],
    [/^(\d+(?:\.\d+)?)\s*([½¼¾⅓⅔])/, (m) => Number(m[1]) + (FRACTIONS[m[2]!] ?? 0)],
    [/^([½¼¾⅓⅔])/, (m) => FRACTIONS[m[1]!] ?? 0],
    [/^(\d+(?:\.\d+)?)/, (m) => Number(m[1])],
  ];
  for (const [pattern, value] of forms) {
    const match = pattern.exec(text);
    if (!match) continue;
    const qty = value(match);
    if (!Number.isFinite(qty) || qty <= 0) return null;
    return { qty, rest: text.slice(match[0].length).trim() };
  }
  return null;
}

/** "1 1/2 cups cooked rice, rinsed" becomes 1.5, "cup", "rice". A line with no amount keeps only its name. */
export function parseIngredient(line: string): Parsed {
  let text = line
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^(?:juice|zest) of\s+/, '')
    .split(',')[0]!
    .trim();
  let qty: number | null = null;
  const first = readNumber(text);
  if (first) {
    qty = first.qty;
    text = first.rest;
    // "2-3" or "2 to 3": plan for the larger.
    const range = /^(?:-|–|to)\s*/.exec(text);
    if (range) {
      const second = readNumber(text.slice(range[0].length));
      if (second) {
        qty = Math.max(qty, second.qty);
        text = second.rest;
      }
    }
  }
  const words = text.split(/\s+/).filter(Boolean);
  let unit: string | null = null;
  if (qty !== null && words[0] && UNITS[words[0]]) {
    unit = UNITS[words[0]]!.unit;
    words.shift();
  }
  if (words[0] === 'of') words.shift();
  const plain = words
    .join(' ')
    .replace(/\b(?:thick|thin|center)[- ]cut\b/g, ' ')
    .replace(/\scut\s+(?:in|up)\b.*$/, '')
    .replace(NAME_ENDS, '')
    .split(/\s+/)
    .filter(Boolean);
  let kept = plain.filter((word) => !DESCRIPTORS.has(word));
  if (kept.length === 0) kept = plain;
  // "cilantro leaves", "thyme sprigs": the herb is what is bought (but a bay leaf is a bay leaf).
  const last = kept[kept.length - 1];
  if (kept.length > 1 && last && /^(?:leaves|sprigs?)$/.test(last) && kept[kept.length - 2] !== 'bay')
    kept.pop();
  return { name: kept.join(' ').trim(), qty, unit };
}

function singular(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (/(oes|ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

const keyOf = (name: string) => name.split(' ').map(singular).join(' ');

function hasWord(name: string, words: readonly string[]): boolean {
  const tokens = ` ${keyOf(name)} `;
  // Whole words only: "sage" is not in "sausage", nor "egg" in "eggplant".
  return words.some((word) => tokens.includes(` ${word} `));
}

/** The aisle for a name, by its words. Anything unknown is pantry. */
export function aisleOf(name: string): Aisle {
  if (hasWord(name, PANTRY_WORDS) || hasWord(name, ['peanut butter', 'almond butter', 'nut butter']))
    return 'Pantry';
  if (hasWord(name, PROTEIN)) return 'Protein';
  if (hasWord(name, DAIRY)) return 'Dairy and eggs';
  if (hasWord(name, PRODUCE)) return 'Produce';
  return 'Pantry';
}

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Whether the fridge holds it. A tinned or bottled thing (broth, sauce, paste) is only the fridge's when the names are
 * the same: "chicken" in the fridge is not "chicken broth".
 */
function atHome(name: string, fridge: readonly string[]): boolean {
  if (hasWord(name, PANTRY_WORDS))
    return fridge.some((item) => keyOf(item.toLowerCase().trim()) === keyOf(name));
  return inFridge(name, fridge);
}

/**
 * What the plan needs from the shop. Every ingredient line of every dish that is eaten is added up (a dish that feeds
 * more meals than it serves is cooked again), pantry basics and what the fridge holds are set aside as "have", and
 * the rest is grouped by aisle. `own` are the things the person added by hand.
 */
export function buildShoppingList(
  meals: readonly StoredMeal[],
  fridge: readonly string[],
  own: readonly string[] = [],
  from?: string,
): ShoppingList {
  const uses = new Map<string, { dish: StoredMeal['dish']; count: number }>();
  for (const meal of eatenMeals(meals, from)) {
    const known = uses.get(meal.dishId);
    if (known) known.count += 1;
    else uses.set(meal.dishId, { dish: meal.dish, count: 1 });
  }

  type Total = { name: string; amounts: Map<string | null, number>; counted: boolean };
  const totals = new Map<string, Total>();
  for (const { dish, count } of uses.values()) {
    const batches = Math.max(1, Math.ceil(count / Math.max(1, dish.serves)));
    for (const line of dish.ingredients) {
      const { name, qty, unit } = parseIngredient(line);
      if (!name) continue;
      const key = keyOf(name);
      const total = totals.get(key) ?? { name, amounts: new Map(), counted: false };
      if (qty !== null) {
        total.amounts.set(unit, (total.amounts.get(unit) ?? 0) + qty * batches);
        total.counted = true;
      }
      totals.set(key, total);
    }
  }

  const have: string[] = [];
  const groups = new Map<Aisle, ShopItem[]>();
  for (const [key, total] of totals) {
    if (STAPLES.has(key) || atHome(total.name, fridge)) {
      have.push(sentence(total.name));
      continue;
    }
    const amount = buyAmount((words) => hasWord(total.name, words), needOf(total.amounts));
    const aisle = aisleOf(total.name);
    groups.set(aisle, [...(groups.get(aisle) ?? []), { key, name: sentence(total.name), amount }]);
  }
  const added = own.map((label) => ({ key: `own:${label}`, name: label, amount: '' }));
  if (added.length > 0) groups.set('Added by you', added);

  const aisles = AISLES.filter((name) => (groups.get(name)?.length ?? 0) > 0).map((name) => ({
    name,
    items: (groups.get(name) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
  }));
  return {
    aisles,
    have: have.sort((a, b) => a.localeCompare(b)),
    toBuy: aisles.reduce((sum, aisle) => sum + aisle.items.length, 0),
  };
}

/** "8 to buy, 14 you already have" */
export function shoppingSummary(list: Pick<ShoppingList, 'toBuy' | 'have'>): string {
  if (list.toBuy === 0) return 'Nothing to buy';
  return list.have.length > 0
    ? `${list.toBuy} to buy, ${list.have.length} you already have`
    : `${list.toBuy} to buy`;
}

/** The list as plain text for sharing: an aisle per paragraph, ticked things left out. */
export function shoppingText(list: ShoppingList, checked: ReadonlySet<string>): string {
  return list.aisles
    .map((aisle) => ({ ...aisle, items: aisle.items.filter((item) => !checked.has(item.key)) }))
    .filter((aisle) => aisle.items.length > 0)
    .map(
      (aisle) =>
        `${aisle.name}\n${aisle.items.map((item) => `- ${item.name}${item.amount ? ` (${item.amount})` : ''}`).join('\n')}`,
    )
    .join('\n\n');
}
