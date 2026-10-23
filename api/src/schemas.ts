import { z } from 'zod';

import { CATEGORIES, CONDITIONS } from './config/ruleset.js';

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

/** What the user is managing. A fixed set (no free text), deduplicated; empty becomes undefined. */
export const conditionsSchema = z
  .array(z.enum(CONDITIONS))
  .max(CONDITIONS.length)
  .transform((value) => {
    const unique = [...new Set(value)];
    return unique.length > 0 ? unique : undefined;
  });

/** JSON body for text analysis. Unknown fields are rejected. */
export const analyzeTextBodySchema = z.strictObject({
  text: z.string().max(200).transform(sanitizeFoodText).pipe(z.string().min(1)),
  details: detailsSchema.optional(),
  portion: portionSchema.optional(),
  conditions: conditionsSchema.optional(),
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
    /** One plain sentence for the top of the verdict screen. Optional so one missing field never fails a check. */
    summary: z.string().max(160).optional(),
    /** A concrete "better next time" change; left out when the verdict is ok. */
    tip: z.string().max(160).optional(),
  }),
});

/** A short label from the app (a meal name, a symptom, a tag): sanitized like food text, never empty. */
const label = (max: number) => z.string().max(max).transform(sanitizeFoodText).pipe(z.string().min(1));

/**
 * What Bellie's summary is built from (POST /v1/insight): only meal names, their verdicts, symptom names and
 * lifestyle tags, each with a short "when". Never notes, photos or the person's name. Unknown fields are rejected.
 */
export const insightBodySchema = z
  .strictObject({
    range: z.enum(['day', 'week']),
    meals: z
      .array(
        z.strictObject({
          name: label(100),
          verdict: z.enum(['ok', 'caution', 'trigger', 'good']),
          when: label(24),
        }),
      )
      .max(60),
    symptoms: z.array(z.strictObject({ name: label(60), when: label(24) })).max(60),
    tags: z.array(label(40)).max(30),
  })
  .refine((body) => body.meals.length + body.symptoms.length > 0, { message: 'nothing to summarize' });

export type InsightInput = z.infer<typeof insightBodySchema>;

/**
 * Bellie's summary. The prompt asks for tighter lengths (line 40, summary 160, tips 120); these caps leave a
 * margin so a slightly long answer doesn't fail the check.
 */
export const insightSchema = z.strictObject({
  tone: z.enum(['cheer', 'nudge', 'neutral']),
  bellieLine: z.string().min(1).max(50),
  summary: z.string().min(1).max(200),
  tips: z.array(z.string().min(1).max(140)).max(3),
});

export type Insight = z.infer<typeof insightSchema>;

/** JSON Schema handed to Claude as the insight tool's input schema. */
export function insightJsonSchema() {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(insightSchema) as Record<string, unknown>;
  return schema as { type: 'object'; [key: string]: unknown };
}

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
