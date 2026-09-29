import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CATEGORIES, ruleset } from '../src/config/ruleset.js';
import { mealAnalysisSchema, sanitizeFoodText } from '../src/schemas.js';
import { goodAnalysis } from './helpers.js';

describe('refluxRuleset.json', () => {
  it('is versioned, flagged for clinician review, and covers exactly the allowed categories', () => {
    expect(ruleset.version).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
    expect(ruleset.needsClinicianReview).toBe(true);
    expect(Object.keys(ruleset.categories).sort()).toEqual([...CATEGORIES].sort());
  });

  it('gives every category a description, keywords and sources that exist', () => {
    const sources = ruleset.sources as Record<string, string>;
    for (const category of Object.values(ruleset.categories)) {
      expect(category.description.length).toBeGreaterThan(20);
      expect(category.keywords.length).toBeGreaterThan(2);
      expect(category.sources.length).toBeGreaterThan(0);
      for (const id of category.sources) expect(sources[id]).toBeTruthy();
    }
  });

  it('matches the trigger categories in the app type', () => {
    const appTypes = readFileSync(new URL('../../app/src/types/analysis.ts', import.meta.url), 'utf8');
    const union = appTypes.match(/export type TriggerCategory =([^;]+);/)?.[1] ?? '';
    const appCategories = [...union.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(appCategories.sort()).toEqual([...CATEGORIES].sort());
  });
});

describe('mealAnalysisSchema', () => {
  it('accepts a valid analysis and rejects unknown fields at every level', () => {
    expect(mealAnalysisSchema.safeParse(goodAnalysis).success).toBe(true);
    const nested = structuredClone(goodAnalysis) as { items: { ingredients: Record<string, unknown>[] }[] };
    nested.items[0]!.ingredients[0]!.extra = true;
    expect(mealAnalysisSchema.safeParse(nested).success).toBe(false);
  });
});

describe('sanitizeFoodText', () => {
  it('normalises whitespace, drops control characters and angle brackets', () => {
    expect(sanitizeFoodText('  a\u0000b\n\nc\t d<e>  ')).toBe('a b c de');
  });
});
