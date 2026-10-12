import type { AppVerdict } from '@/types/analysis';

import type { TimelineEntry } from './timeline';

/** Best to worst, the order of the bar and its legend. */
export const SUMMARY_VERDICTS: AppVerdict[] = ['good', 'ok', 'caution', 'trigger'];

export type HistorySummary = {
  meals: number;
  /** Days that have at least one symptom entry. */
  symptomDays: number;
  /** Meals per verdict. Meals saved without a verdict are not counted here, only in `meals`. */
  verdicts: Record<AppVerdict, number>;
};

/** The numbers on History's summary card, for the entries of the shown period. */
export function summarize(
  entries: readonly TimelineEntry[],
  dayKeyOf: (entry: TimelineEntry) => string,
): HistorySummary {
  const verdicts: Record<AppVerdict, number> = { good: 0, ok: 0, caution: 0, trigger: 0 };
  const symptomDays = new Set<string>();
  let meals = 0;
  for (const entry of entries) {
    if (entry.kind === 'food') {
      meals += 1;
      if (entry.log.overallVerdict) verdicts[entry.log.overallVerdict] += 1;
    } else if (entry.kind === 'symptom') {
      symptomDays.add(dayKeyOf(entry));
    }
  }
  return { meals, symptomDays: symptomDays.size, verdicts };
}
