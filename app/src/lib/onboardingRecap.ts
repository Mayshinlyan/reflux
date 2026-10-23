import { SYMPTOM_ITEMS, type SymptomKey } from '@/constants/symptomItems';

const SHOWN = 3;

/**
 * The "Watching for" line on the onboarding recap: "Heartburn and hoarse voice". Up to three are named; more become
 * "Heartburn, burping, hoarse voice and 2 more". With none picked it stays gentle instead of empty.
 */
export function watchingLine(keys: readonly SymptomKey[]): string {
  const labels = keys
    .map((key): string | undefined => SYMPTOM_ITEMS.find((item) => item.key === key)?.label)
    .filter((label): label is string => Boolean(label))
    .map((label) => label.toLowerCase());
  if (labels.length === 0) return 'Whatever you notice';

  const shown = labels.slice(0, SHOWN);
  const extra = labels.length - shown.length;
  if (extra > 0) shown.push(`${extra} more`);
  const text =
    shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown[0];
  return text.charAt(0).toUpperCase() + text.slice(1);
}
