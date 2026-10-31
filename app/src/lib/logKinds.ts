import { Activity, type LucideIcon, Pill, Utensils } from 'lucide-react-native';

import type { ColorToken } from '@/theme';

export type LogKind = 'food' | 'symptoms' | 'medication';

/** What can be logged, with one name, icon and tint everywhere: the quick log arch. */
export const LOG_KINDS: { kind: LogKind; label: string; icon: LucideIcon; tint: ColorToken }[] = [
  { kind: 'food', label: 'Food', icon: Utensils, tint: 'honeyTint' },
  { kind: 'symptoms', label: 'How I feel', icon: Activity, tint: 'clayTint' },
  { kind: 'medication', label: 'Medication', icon: Pill, tint: 'sageTint' },
];
