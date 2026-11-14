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

/** The cuisines the Kitchen offers; `any` leaves the choice to Bellie. A fixed set, so it can go into the prompt as is. */
export const CUISINES = [
  'any',
  'chinese',
  'indian',
  'italian',
  'japanese',
  'korean',
  'mediterranean',
  'mexican',
  'thai',
  'vietnamese',
] as const;

/** "Ready in": 20 or 40 minutes at most (prep included), or `long` for no limit. */
export const RECIPE_TIMES = ['20', '40', 'long'] as const;

/**
 * What the Kitchen's recipe ideas are built from (POST /v1/recipe-ideas): the choices on the sheet, what the person
 * is managing, and food names only (favorites, foods that bothered them, foods they never eat, dishes already shown).
 * Never symptom logs, notes, photos or the person's name. Unknown fields are rejected.
 */
export const recipeIdeasBodySchema = z.strictObject({
  cuisine: z.enum(CUISINES),
  time: z.enum(RECIPE_TIMES),
  serves: z.number().int().min(1).max(6),
  conditions: conditionsSchema.optional(),
  /** Ingredients the person typed to use. */
  want: z.array(label(40)).max(10).optional(),
  /** What the person's saved fridge holds (food names), when "Use my fridge" is on. */
  fridge: z.array(label(40)).max(40).optional(),
  favorites: z.array(label(60)).max(15).optional(),
  /** Foods that bothered them before: kept out, or at least gone easy on. */
  triggers: z.array(label(60)).max(20).optional(),
  /** Foods they never eat (an allergy, a diet). A hard rule, checked again on the way back. */
  avoid: z.array(label(60)).max(30).optional(),
  /** Dishes already shown this session, so "Generate more" gives new ones. */
  shown: z.array(label(80)).max(12).optional(),
});

export type RecipeIdeasInput = z.infer<typeof recipeIdeasBodySchema>;

/** One recipe. Lengths leave a margin over what the prompt asks for, so a slightly long answer doesn't fail. */
const recipeSchema = z.strictObject({
  title: z.string().min(1).max(60),
  /** Total time, prep included. */
  minutes: z.number().int().min(5).max(240),
  serves: z.number().int().min(1).max(12),
  /** Why it goes easy on the belly: a sentence or two. */
  why: z.string().min(1).max(240),
  /** One practical tip about eating it; may be empty. */
  tip: z.string().max(180),
  /** Each with its amount in US cups and spoons, e.g. "1 1/2 cups cooked rice". */
  ingredients: z.array(z.string().min(1).max(80)).min(2).max(24),
  steps: z.array(z.string().min(1).max(280)).min(2).max(12),
});

export const recipeIdeasSchema = z.strictObject({ recipes: z.array(recipeSchema).min(1).max(3) });

export type RecipeIdeas = z.infer<typeof recipeIdeasSchema>;
export type Recipe = z.infer<typeof recipeSchema>;

/** JSON Schema handed to Claude as the recipe tool's input schema. */
export function recipeIdeasJsonSchema() {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(recipeIdeasSchema) as Record<string, unknown>;
  return schema as { type: 'object'; [key: string]: unknown };
}

/** The food names Claude finds in one to three fridge photos. Empty when nothing edible could be made out. */
export const fridgeScanSchema = z.strictObject({ items: z.array(label(40)).max(40) });

export type FridgeScan = z.infer<typeof fridgeScanSchema>;

/** JSON Schema handed to Claude as the fridge tool's input schema. */
export function fridgeScanJsonSchema() {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(fridgeScanSchema) as Record<string, unknown>;
  return schema as { type: 'object'; [key: string]: unknown };
}

export const MAX_FEEDBACK_CHARS = 2000;

/** Feedback keeps its line breaks; other control characters become spaces and the ends are trimmed. */
function cleanFeedback(raw: string): string {
  return (
    raw
      .replace(/\r\n?/g, '\n')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, ' ')
      .trim()
  );
}

/** JSON body for POST /v1/feedback: the typed message plus what version and phone it came from. Unknown fields are rejected. */
export const feedbackBodySchema = z.strictObject({
  // The length is checked after cleaning, so it counts what is stored (and a CRLF pair counts once, like the phone's field).
  message: z.string().transform(cleanFeedback).pipe(z.string().min(1).max(MAX_FEEDBACK_CHARS)),
  appVersion: z.string().max(32).optional(),
  platform: z.enum(['ios', 'android']).optional(),
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

/** The symptom names the app can store as built-in keys; the voice prompt offers these first. */
export const VOICE_SYMPTOM_KEYS = [
  'hoarseness',
  'throat_clearing',
  'mucus',
  'swallowing',
  'cough_after_eating',
  'breathing',
  'cough',
  'lump',
  'heartburn',
  'burping',
  'stomach_pain',
  'feeling_full',
  'constipation',
] as const;

/**
 * What the app sends beside a spoken log's audio (a JSON string in the `context` field): the phone's clock and
 * zone so "around eight" can become a time, and short lists of the person's own foods and symptoms, which help
 * the speech model spell them. Nothing else. Unknown fields are rejected.
 */
export const voiceContextSchema = z.strictObject({
  now: z.iso.datetime({ offset: true }),
  tz: z.string().min(1).max(64).transform(sanitizeFoodText),
  foods: z.array(label(60)).max(40).default([]),
  symptoms: z.array(label(40)).max(20).default([]),
});

export type VoiceContext = z.infer<typeof voiceContextSchema>;

/** What Claude pulls out of the transcript. A symptom is a built-in key, or the person's own words (max 40). */
export const voiceExtractSchema = z.strictObject({
  foods: z.array(z.string().min(1).max(60)).max(8),
  symptoms: z.array(z.string().min(1).max(40)).max(6),
  /** When the food was eaten, as an ISO time with offset; null means "just now". */
  at: z.iso.datetime({ offset: true }).nullable(),
});

export type VoiceExtract = z.infer<typeof voiceExtractSchema>;

/** JSON Schema handed to Claude as the voice tool's input schema. */
export function voiceExtractJsonSchema() {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(voiceExtractSchema) as Record<string, unknown>;
  return schema as { type: 'object'; [key: string]: unknown };
}
