import { Activity, type LucideIcon, Pill, Utensils } from 'lucide-react-native';

import type { ColorToken } from '@/theme';

export type LogKind = 'food' | 'symptoms' | 'medication';

type LogKindStyle = { kind: LogKind; label: string; icon: LucideIcon; tint: ColorToken; ink: ColorToken };

/**
 * What can be logged, with one name, icon and colour everywhere: the quick log arch and the diary rows.
 * Food is honey, How I feel is clay and medication is sage.
 */
export const LOG_KINDS: LogKindStyle[] = [
  { kind: 'food', label: 'Food', icon: Utensils, tint: 'honeyTint', ink: 'honeyInk' },
  { kind: 'symptoms', label: 'How I feel', icon: Activity, tint: 'clayTint', ink: 'clayInk' },
  { kind: 'medication', label: 'Medication', icon: Pill, tint: 'sageTint', ink: 'sageInk' },
];

/** The look of one kind, by its `LogKind` name. */
export function logKindStyle(kind: LogKind): LogKindStyle {
  return LOG_KINDS.find((item) => item.kind === kind) ?? LOG_KINDS[0]!;
}
