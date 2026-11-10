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

/** How a trigger reads as a group of meals in the weekly report ("Spicy meals"), where the short label is vague. */
export const TRIGGER_GROUP_NAMES: Record<TriggerCategory, string> = {
  acidic: 'Acidic meals',
  caffeine: 'Caffeine',
  mint: 'Mint',
  alcohol: 'Alcohol',
  carbonation: 'Fizzy drinks',
  high_fat: 'Fatty meals',
  spicy: 'Spicy meals',
  chocolate: 'Chocolate',
  raw_garlic_onion: 'Raw garlic or onion',
  large_portion: 'Large portions',
};
