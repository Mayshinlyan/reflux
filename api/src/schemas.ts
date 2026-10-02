import { z } from 'zod';

import { CATEGORIES } from './config/ruleset.js';

/** Control characters (incl. newlines and tabs) become spaces; angle brackets are dropped so text can't close our delimiter. */
export function sanitizeFoodText(raw: string): string {
  return (
    raw
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
      .replace(/[<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export const MAX_DETAILS_CHARS = 300;

/** Optional extra context from the user (what the food is, how it was made). Blank becomes undefined. */
export const detailsSchema = z
  .string()
  .max(MAX_DETAILS_CHARS)
  .transform((value) => sanitizeFoodText(value) || undefined);

/** How much the user ate. A fixed set, so it can go into the prompt without sanitizing. */
export const portionSchema = z.enum(['small', 'regular', 'large']);

/** JSON body for text analysis. Unknown fields are rejected. */
export const analyzeTextBodySchema = z.strictObject({
  text: z.string().max(200).transform(sanitizeFoodText).pipe(z.string().min(1)),
  details: detailsSchema.optional(),
  portion: portionSchema.optional(),
});

// The output schema mirrors app/src/types/analysis.ts. Keep the two in sync.
const category = z.enum(CATEGORIES);
const verdict = z.enum(['ok', 'caution', 'trigger']);

const mealItemSchema = z.strictObject({
  name: z.string().min(1).max(100),
  ingredients: z
    .array(z.strictObject({ name: z.string().min(1).max(60), matchedCategories: z.array(category).max(10) }))
    .max(20),
  verdict,
  reasoning: z.string().max(300),
  matchedTriggers: z.array(z.strictObject({ category, evidence: z.string().max(200) })).max(10),
});

export const mealAnalysisSchema = z.strictObject({
  isFood: z.boolean(),
  mealName: z.string().max(100),
  items: z.array(mealItemSchema).max(8),
  overall: z.strictObject({
    verdict,
    confidence: z.enum(['low', 'medium', 'high']),
    reasoning: z.string().max(400),
  }),
});

export type Portion = z.infer<typeof portionSchema>;

export type MealAnalysis = z.infer<typeof mealAnalysisSchema>;

export type AnalysisMeta = { model: string; promptVersion: string; rulesetVersion: string };

/** JSON Schema handed to Claude as the tool's input schema. */
export function mealAnalysisJsonSchema() {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(mealAnalysisSchema) as Record<string, unknown>;
  return schema as { type: 'object'; [key: string]: unknown };
}

/** Zod issue paths only (never values), safe to log. */
export function issuePaths(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) => issue.path.join('.') || '(root)'))].slice(0, 20);
}

/** Zod issue codes only (e.g. `invalid_value`, `unrecognized_keys`), never values, safe to log. */
export function issueCodes(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) => issue.code))];
}
