import { formatTime, localDayKey } from '@/lib/localDay';
import { symptomLabel, tagLabel, type TimelineEntry } from '@/lib/timeline';
import type { Insight, InsightRange, InsightRequest } from '@/types/insight';

/** The relay's caps on what one request may carry (see its `insightBodySchema`). */
const MAX_MEALS = 60;
const MAX_SYMPTOMS = 60;
const MAX_TAGS = 30;
const MAX_MEAL_NAME = 100;
const MAX_SYMPTOM_NAME = 60;
const MAX_TAG = 40;

/**
 * A label the way the relay will clean it (no angle brackets, runs of spaces and line breaks become one space),
 * cut to its cap. Empty when nothing is left, so one odd typed entry ("<>") is left out instead of making the
 * relay reject the whole summary.
 */
const clean = (text: string, max: number) =>
  text.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max).trim();

/** "Mon" for a local day key, in English like the rest of the app's day labels. */
function weekdayShort(dayKey: string): string {
  return new Date(`${dayKey}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
}

/**
 * What to send for a day or a week: only meals that have a verdict (a meal logged without checking has none),
 * symptoms and lifestyle tags, each placed by its time. Null when there is nothing to summarise.
 */
export function buildInsightRequest(range: InsightRange, entries: TimelineEntry[]): InsightRequest | null {
  const when = (at: string, tz: string) =>
    range === 'day' ? formatTime(at, tz) : `${weekdayShort(localDayKey(at, tz))} ${formatTime(at, tz)}`;
  const meals: InsightRequest['meals'] = [];
  const symptoms: InsightRequest['symptoms'] = [];
  const tags = new Set<string>();

  // Oldest first, so the story reads in the order it happened.
  for (const entry of [...entries].sort((a, b) => a.at.localeCompare(b.at))) {
    if (entry.kind === 'food' && entry.log.overallVerdict) {
      const name = clean(entry.log.mealName, MAX_MEAL_NAME);
      if (name) meals.push({ name, verdict: entry.log.overallVerdict, when: when(entry.at, entry.tz) });
    } else if (entry.kind === 'symptom') {
      for (const item of entry.log.items) {
        const name = clean(symptomLabel(item.key), MAX_SYMPTOM_NAME);
        if (name) symptoms.push({ name, when: when(entry.at, entry.tz) });
      }
      for (const tag of entry.log.tags) {
        const label = clean(tagLabel(tag), MAX_TAG);
        if (label) tags.add(label);
      }
    }
  }
  if (meals.length + symptoms.length === 0) return null;
  return {
    range,
    meals: meals.slice(0, MAX_MEALS),
    symptoms: symptoms.slice(0, MAX_SYMPTOMS),
    tags: [...tags].slice(0, MAX_TAGS),
  };
}

/** A short stable fingerprint of a request, so a summary is only asked for again when what was logged changes. */
export function insightHash(request: InsightRequest): string {
  const text = JSON.stringify(request);
  let hash = 0x811c9dc5; // FNV-1a
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Plain words from the numbers alone, for when the relay can't be reached (offline, over its daily limit) or
 * while the real summary is on its way. Same shape as the AI's, so the screens don't care which they show.
 */
export function fallbackInsight(request: InsightRequest): Insight {
  const total = request.meals.length;
  const good = request.meals.filter((meal) => meal.verdict === 'good' || meal.verdict === 'ok').length;
  const watch = total - good;
  const symptoms = request.symptoms.length;
  const day = request.range === 'day';
  const tone = watch === 0 && symptoms === 0 ? 'cheer' : 'nudge';

  const bellieLine = day
    ? tone === 'cheer'
      ? 'A calm day so far!'
      : symptoms > 0
        ? 'Be gentle tonight.'
        : 'Go easy tonight?'
    : tone === 'cheer'
      ? 'A good week so far!'
      : 'A few bumps this week.';

  const parts: string[] = [];
  if (total > 0) {
    const span = day ? 'today' : 'this week';
    parts.push(
      watch > 0
        ? `${plural(total, 'meal', 'meals')} ${span}: ${good} good, ${watch} to watch.`
        : `${plural(total, 'meal', 'meals')} ${span}, all good.`,
    );
  }
  if (symptoms > 0) parts.push(`${plural(symptoms, 'symptom', 'symptoms')} logged.`);

  const tips =
    watch > 0 ? ['Have the trickier foods earlier in the day.', 'A smaller portion can help.'] : [];
  return { tone, bellieLine, summary: parts.join(' '), tips };
}

/** True for a well-formed summary, whether it came from the relay or from the cache. */
export function isInsight(value: unknown): value is Insight {
  if (typeof value !== 'object' || value === null) return false;
  const insight = value as Record<string, unknown>;
  return (
    (insight.tone === 'cheer' || insight.tone === 'nudge' || insight.tone === 'neutral') &&
    typeof insight.bellieLine === 'string' &&
    insight.bellieLine.length > 0 &&
    typeof insight.summary === 'string' &&
    Array.isArray(insight.tips) &&
    insight.tips.every((tip) => typeof tip === 'string')
  );
}
