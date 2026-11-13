import type { LoggedSymptomKey, SymptomKey } from '@/constants/symptomItems';

/** What Bellie heard in a spoken log: the foods, the symptoms, and when (null = now). */
export type VoiceHeard = { foods: string[]; symptoms: LoggedSymptomKey[]; at: Date | null };

const MAX_FOODS = 4;
const MAX_FOOD_LENGTH = 40;

/** Words that say a symptom, in the order tried. "cough after eating" is tried before a plain cough. */
const SYMPTOM_WORDS: [RegExp, SymptomKey][] = [
  [/heartburn|chest (?:is |feels? )?burn|burning/i, 'heartburn'],
  [/burp/i, 'burping'],
  [/hoarse/i, 'hoarseness'],
  [/throat clearing|clearing my throat/i, 'throat_clearing'],
  [/mucus|phlegm/i, 'mucus'],
  [/trouble swallowing|hard to swallow/i, 'swallowing'],
  [/cough(?:ing)? after/i, 'cough_after_eating'],
  [/breath/i, 'breathing'],
  [/cough/i, 'cough'],
  [/lump/i, 'lump'],
  [/stomach (?:pain|ache|hurts)/i, 'stomach_pain'],
  [/\bfull\b|bloat/i, 'feeling_full'],
  [/constipat/i, 'constipation'],
];

/** "had pasta and a glass of wine around eight": what follows the verb, up to a time word or the end. */
const EATING =
  /\b(?:had|ate|eaten|eating|having|drank|drinking)\s+(.+?)(?=\s+(?:around|at|about|this|today|earlier|but|now)\b|\s+and\s+(?:now|then)\b|[.,;]|$)/i;
const HOUR_WORDS = [
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];
const TIME = new RegExp(
  `\\b(?:around|at|about)\\s+(\\d{1,2}|${HOUR_WORDS.join('|')})(?::(\\d{2}))?\\s*(am|pm)?\\b`,
  'i',
);

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function foodsIn(text: string): string[] {
  const phrase = EATING.exec(text)?.[1];
  if (!phrase) return [];
  return phrase
    .split(/\s*(?:,|\band\b|\bwith\b)\s*/i)
    .map((part) => part.replace(/^(?:a|an|some|the|my)\s+/i, '').trim())
    .filter((part) => part.length > 0)
    .slice(0, MAX_FOODS)
    .map((part) => capitalise(Array.from(part).slice(0, MAX_FOOD_LENGTH).join('').trim()));
}

/** "around eight" is the latest such time that is not in the future today; null when it can't be placed. */
function timeIn(text: string, now: Date): Date | null {
  const match = TIME.exec(text);
  if (!match) return null;
  const spoken = HOUR_WORDS.indexOf(match[1].toLowerCase()) + 1;
  const hour = spoken > 0 ? spoken : Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (hour > 12 || minutes > 59) return null;
  const meridiem = match[3]?.toLowerCase();
  const hours =
    meridiem === 'am' ? [hour % 12] : meridiem === 'pm' ? [(hour % 12) + 12] : [(hour % 12) + 12, hour % 12];
  for (const h of hours) {
    const at = new Date(now);
    at.setHours(h, minutes, 0, 0);
    if (at.getTime() <= now.getTime()) return at;
  }
  return null;
}

/**
 * A plain-words stand-in for the AI step (the next PR swaps it for the relay): finds foods after "had / ate /
 * drank", the symptoms named in everyday words, and a time like "around eight". The confirm card shows the
 * result, so a miss is one tap to fix.
 */
export function parseTranscript(text: string, now: Date = new Date()): VoiceHeard {
  const symptoms: SymptomKey[] = [];
  for (const [pattern, key] of SYMPTOM_WORDS) {
    if (!pattern.test(text)) continue;
    // A cough after eating is not also a plain cough.
    if (key === 'cough' && symptoms.includes('cough_after_eating')) continue;
    if (!symptoms.includes(key)) symptoms.push(key);
  }
  return { foods: foodsIn(text), symptoms, at: timeIn(text, now) };
}
