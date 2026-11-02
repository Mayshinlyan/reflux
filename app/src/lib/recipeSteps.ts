import type { ColorToken } from '@/theme';

/** What a step is mostly about, which picks its icon on the step card (Figma row 29e3). */
export type StepKind = 'wait' | 'serve' | 'bake' | 'heat' | 'chop' | 'stir' | 'add' | 'other';

/**
 * Checked in this order, so a step that says "turn off the heat and let it rest" is about waiting, not heat, and
 * "serve warm" is about serving. A word has to start at a word boundary ("rest", not the end of "forest").
 */
const KINDS: readonly { kind: Exclude<StepKind, 'other'>; words: RegExp }[] = [
  { kind: 'wait', words: /\b(rest|cool|chill|wait|let (it|them) (sit|stand|rest|cool))/i },
  { kind: 'serve', words: /\b(serve|plate|garnish|spoon (it|them|the)|ladle|enjoy)/i },
  { kind: 'bake', words: /\b(bake|roast|broil|grill|oven)/i },
  {
    kind: 'heat',
    words: /\b(heat|warm|simmer|boil|fry|sauté|saute|sear|steam|poach|toast|cook|melt|brown)/i,
  },
  { kind: 'chop', words: /\b(chop|slice|dice|mince|cut|peel|trim|grate|shred|halve)/i },
  { kind: 'stir', words: /\b(stir|mix|whisk|fold|scramble|toss|combine|blend|beat|mash|knead)/i },
  { kind: 'add', words: /\b(add|pour|drizzle|sprinkle|season|rinse|wash|drain|soak|spread|top)/i },
];

export function stepKind(text: string): StepKind {
  return KINDS.find((entry) => entry.words.test(text))?.kind ?? 'other';
}

/** Soft colours for the icon tile, taken in turn so neighbouring cards differ. */
export const STEP_TONES: readonly { tint: ColorToken; ink: ColorToken }[] = [
  { tint: 'honeyTint', ink: 'honeyInk' },
  { tint: 'mintTint', ink: 'mintInk' },
  { tint: 'skyTint', ink: 'skyInk' },
  { tint: 'roseTint', ink: 'roseInk' },
];

export const stepTone = (index: number) =>
  STEP_TONES[((index % STEP_TONES.length) + STEP_TONES.length) % STEP_TONES.length]!;

// The number may not be the bottom of a fraction ("1/2 minute" is not "2 min").
const TIME =
  /(?<![\d/.])(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|minutes?|mins?)\b/i;

const minutesLabel = (minutes: number) => {
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
};

/**
 * The first time a step names ("for 2 minutes", "10 to 12 minutes", "1.5 hours") as a short label for the chip, or
 * null when it names none. A range keeps both ends ("10–12 min").
 */
export function stepTime(text: string): string | null {
  const match = TIME.exec(text);
  if (!match) return null;
  const perUnit = /^h/i.test(match[3] ?? '') ? 60 : 1;
  const low = Number(match[1]) * perUnit;
  if (!(low > 0)) return null;
  if (match[2] === undefined) return minutesLabel(low);
  const high = Number(match[2]) * perUnit;
  if (!(high > low)) return minutesLabel(low);
  return perUnit === 1
    ? `${Math.round(low)}–${minutesLabel(high)}`
    : `${minutesLabel(low)} to ${minutesLabel(high)}`;
}
