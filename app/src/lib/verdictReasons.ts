import { TRIGGER_LABELS } from '@/constants/triggerLabels';
import type { MealAnalysis } from '@/types/analysis';

import { plainText } from './plainText';

const MAX_REASONS = 4;

/**
 * The bullets under "Why we think so": the overall reasoning split into sentences, plus a bedtime note when
 * the meal is late. Falls back to the first item's reasoning if the overall one is empty.
 */
export function verdictReasons(analysis: MealAnalysis, { late }: { late: boolean }): string[] {
  const text = plainText(analysis.overall.reasoning.trim() || analysis.items[0]?.reasoning.trim() || '');
  const sentences = (text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const reasons = sentences.slice(0, late ? MAX_REASONS - 1 : MAX_REASONS);
  if (late) reasons.push('Eaten close to bedtime.');
  return reasons;
}

/** The trigger tags on the verdict screen: each matched category once, in order, then "Late meal". */
export function matchedTriggerLabels(analysis: MealAnalysis, { late }: { late: boolean }): string[] {
  const categories = new Set(analysis.items.flatMap((item) => item.matchedTriggers.map((t) => t.category)));
  const labels = [...categories].map((category) => TRIGGER_LABELS[category]);
  if (late) labels.push('Late meal');
  return labels;
}
