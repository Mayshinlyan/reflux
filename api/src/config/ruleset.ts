import rulesetJson from './refluxRuleset.json' with { type: 'json' };

export const ruleset = rulesetJson;

/** Single source of truth for trigger categories: the zod enums and the prompt both derive from this. */
export const CATEGORIES = [
  'acidic',
  'caffeine',
  'mint',
  'alcohol',
  'carbonation',
  'high_fat',
  'spicy',
  'chocolate',
  'raw_garlic_onion',
  'large_portion',
] as const;

export type TriggerCategory = (typeof CATEGORIES)[number];

export const RULESET_VERSION: string = ruleset.version;
