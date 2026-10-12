import { LIFESTYLE_TAGS, type LifestyleTagKey } from '@/constants/lifestyleTags';
import { RETIRED_SYMPTOM_KEYS, SYMPTOM_ITEMS } from '@/constants/symptomItems';
import type { AppVerdict } from '@/types/analysis';

import { symptomLabel, tagLabel, type TimelineEntry } from './timeline';

/** Best to worst, the order of the donut and its legend. */
export const SUMMARY_VERDICTS: AppVerdict[] = ['good', 'ok', 'caution', 'trigger'];

/** How many symptoms the Top symptoms card lists. */
export const TOP_SYMPTOMS = 6;

export type RankedCount = { key: string; label: string; count: number };

export type HistorySummary = {
  meals: number;
  /** Days that have at least one symptom entry. */
  symptomDays: number;
  /** Meals per verdict. Meals saved without a verdict are not counted here, only in `meals`. */
  verdicts: Record<AppVerdict, number>;
  /**
   * `TOP_SYMPTOMS` symptoms: those logged in the period, most often first (each entry counts once), then, if fewer
   * were logged, others in the picker's order at 0.
   */
  symptoms: RankedCount[];
  /** Every lifestyle tag, most often first (ties keep the picker's order), including those used 0 times. */
  tags: RankedCount[];
};

/** Most first; equal counts keep the order they came in. */
const byCount = (a: RankedCount, b: RankedCount) => b.count - a.count;

/**
 * The numbers on History's stats cards, for the entries of the shown period. `mealTags` holds the
 * lifestyle tags of each meal by id; symptom entries carry their own.
 */
export function summarize(
  entries: readonly TimelineEntry[],
  dayKeyOf: (entry: TimelineEntry) => string,
  mealTags: ReadonlyMap<number, readonly LifestyleTagKey[]> = new Map(),
): HistorySummary {
  const verdicts: Record<AppVerdict, number> = { good: 0, ok: 0, caution: 0, trigger: 0 };
  const symptomDays = new Set<string>();
  const symptomCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  const countTags = (tags: readonly string[]) => {
    for (const tag of new Set(tags)) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  };
  let meals = 0;
  for (const entry of entries) {
    if (entry.kind === 'food') {
      meals += 1;
      if (entry.log.overallVerdict) verdicts[entry.log.overallVerdict] += 1;
      countTags(mealTags.get(entry.id) ?? []);
    } else if (entry.kind === 'symptom') {
      symptomDays.add(dayKeyOf(entry));
      for (const item of entry.log.items) symptomCounts.set(item.key, (symptomCounts.get(item.key) ?? 0) + 1);
      countTags(entry.log.tags);
    }
  }
  const logged = [...symptomCounts]
    .map(([key, count]) => ({ key, label: symptomLabel(key), count }))
    .sort(byCount)
    .slice(0, TOP_SYMPTOMS);
  const unlogged = SYMPTOM_ITEMS.filter(
    (item) => !symptomCounts.has(item.key) && !RETIRED_SYMPTOM_KEYS.includes(item.key),
  ).map((item) => ({ key: item.key, label: item.label, count: 0 }));
  const symptoms = [...logged, ...unlogged].slice(0, TOP_SYMPTOMS);
  const tags = LIFESTYLE_TAGS.map((tag) => ({
    key: tag.key,
    label: tagLabel(tag.key),
    count: tagCounts.get(tag.key) ?? 0,
  })).sort(byCount);
  return { meals, symptomDays: symptomDays.size, verdicts, symptoms, tags };
}

/** The meals that have a verdict. */
export const ratedMeals = (summary: HistorySummary) =>
  SUMMARY_VERDICTS.reduce((total, verdict) => total + summary.verdicts[verdict], 0);

/** The one line under the Food card's donut, from how many of the rated meals were good. */
export function goodLine(summary: HistorySummary): string {
  const rated = ratedMeals(summary);
  if (rated === 0) return 'No verdicts yet.';
  const share = summary.verdicts.good / rated;
  if (share === 1) return 'All of your meals were good.';
  if (share > 0.5) return 'Most of your meals were good.';
  if (share === 0.5) return 'Half of your meals were good.';
  if (share > 0) return 'Some of your meals were good.';
  return 'None of your meals were good.';
}

export type DonutSegment = { verdict: AppVerdict; start: number; sweep: number };

/**
 * The donut's arcs, in radians clockwise from 12 o'clock, one per verdict that has meals. They share the
 * circle in proportion, with `gap` between neighbours (none when there is only one, so it closes into a ring).
 */
export function donutSegments(verdicts: Record<AppVerdict, number>, gap = 0.07): DonutSegment[] {
  const counted = SUMMARY_VERDICTS.filter((verdict) => verdicts[verdict] > 0);
  const total = counted.reduce((sum, verdict) => sum + verdicts[verdict], 0);
  if (total === 0) return [];
  const gaps = counted.length > 1 ? gap : 0;
  const usable = 2 * Math.PI - gaps * counted.length;
  let start = gaps / 2;
  return counted.map((verdict) => {
    const sweep = (usable * verdicts[verdict]) / total;
    const segment = { verdict, start, sweep };
    start += sweep + gaps;
    return segment;
  });
}
