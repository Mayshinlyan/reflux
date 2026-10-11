import type { TriggerCategory } from '@/types/analysis';

/** Short names for the trigger categories, as shown on the verdict screen's "Matched triggers" tags. */
export const TRIGGER_LABELS: Record<TriggerCategory, string> = {
  acidic: 'Acidic',
  caffeine: 'Caffeine',
  mint: 'Mint',
  alcohol: 'Alcohol',
  carbonation: 'Fizzy',
  high_fat: 'Fatty',
  spicy: 'Spicy',
  chocolate: 'Chocolate',
  raw_garlic_onion: 'Raw garlic or onion',
  large_portion: 'Large portion',
};
