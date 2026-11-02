import { type NextFunction, type Request, type Response, Router } from 'express';
import type { Logger } from 'pino';

import { HttpError } from '../errors.js';
import { firebaseAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { RECIPE_PROMPT_VERSION } from '../prompts/recipePrompt.js';
import {
  issueCodes,
  issuePaths,
  type Recipe,
  type RecipeIdeas,
  type RecipeIdeasInput,
  recipeIdeasBodySchema,
  recipeIdeasSchema,
} from '../schemas.js';
import type { AnalyzeDeps } from './analyze.routes.js';

/** The same kill switch as meal checks: answers SERVICE_BUSY before any auth, quota or Claude work happens. */
export function killSwitch(enabled: boolean) {
  return (_req: Request, _res: Response, next: NextFunction) =>
    next(enabled ? undefined : new HttpError('SERVICE_BUSY'));
}

/** A bad model answer (truncated, no tool call, off-schema, or nothing left after the safety check) is usually a one-off. */
const MAX_ATTEMPTS = 2;

/** Lowercase, no accents ("jalapeño" is "jalapeno"), hyphens as spaces ("stir-fry" is "stir fry"), one space between words. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[-–—_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The spellings a never-eat food can show up in: as typed, its singular, and the plurals of that, so "eggs" finds
 * "1 egg", "nuts" finds "walnut", "tomatoes" finds "tomato" and "berry" finds "blueberries". It over-matches on
 * purpose (a longer word that contains the food counts), because dropping a safe recipe costs a retry and missing
 * an unsafe one does not.
 */
export function neverEatForms(term: string): string[] {
  const typed = normalize(term);
  let singular = typed;
  if (typed.length > 4 && typed.endsWith('ies')) singular = `${typed.slice(0, -3)}y`;
  else if (/(oes|ches|shes|xes|sses)$/.test(typed)) singular = typed.slice(0, -2);
  else if (typed.length >= 3 && typed.endsWith('s') && !/(ss|us|is)$/.test(typed))
    singular = typed.slice(0, -1);
  const forms = new Set([typed, singular, `${singular}s`, `${singular}es`]);
  if (singular.endsWith('y')) forms.add(`${singular.slice(0, -1)}ies`);
  // "cookies" is "cookie", not "cooky": the plain trailing-s form is searched too.
  if (typed.endsWith('ies')) forms.add(typed.slice(0, -1));
  // A stem cut down to two letters ("gas" to "ga") would match half the pantry; only the word as typed may be short.
  return [...forms].filter((form) => form.length >= 3 || form === typed);
}

/**
 * True when anything a recipe says (its name, why, tip, ingredients or steps) contains a food the person never eats.
 * The prompt already makes this a hard rule; this is the safety net for when the model slips. It is a plain
 * text match, so it cannot catch a food hidden behind another name, which is why the prompt names hidden forms too.
 */
export function breaksNeverEat(recipe: Recipe, avoid: readonly string[] | undefined): boolean {
  if (!avoid || avoid.length === 0) return false;
  const text = normalize(
    [recipe.title, recipe.why, recipe.tip, ...recipe.ingredients, ...recipe.steps].join(' \n '),
  );
  return avoid.some((term) => neverEatForms(term).some((form) => text.includes(form)));
}

/** Recipe ideas for the Kitchen (POST /v1/recipe-ideas), on their own daily allowance per person. */
export function recipeRoutes({ env, verifier, rateLimitStore, claude }: AnalyzeDeps) {
  const router = Router();

  async function ideasWithRetry(input: RecipeIdeasInput, log: Logger): Promise<RecipeIdeas> {
    for (let attempt = 1; ; attempt += 1) {
      let failure: HttpError;
      try {
        const { raw, telemetry } = await claude.recipes(input);
        const parsed = recipeIdeasSchema.safeParse(raw);
        // Telemetry is numbers and ids only. Zod failures are logged as paths and codes, never values.
        log.info(
          {
            ...telemetry,
            attempt,
            kind: 'recipes',
            status: parsed.success ? 'ok' : 'invalid_output',
            zodPaths: parsed.success ? undefined : issuePaths(parsed.error),
            zodCodes: parsed.success ? undefined : issueCodes(parsed.error),
          },
          'claude call completed',
        );
        if (parsed.success) {
          const safe = parsed.data.recipes.filter((recipe) => !breaksNeverEat(recipe, input.avoid));
          if (safe.length < parsed.data.recipes.length) {
            log.warn(
              { attempt, dropped: parsed.data.recipes.length - safe.length },
              'recipes dropped by never-eat check',
            );
          }
          if (safe.length > 0) return { recipes: safe };
        }
        failure = new HttpError('AI_INVALID_OUTPUT');
      } catch (error) {
        if (!(error instanceof HttpError && error.code === 'AI_INVALID_OUTPUT')) throw error;
        failure = error;
      }
      if (attempt >= MAX_ATTEMPTS) throw failure;
      log.warn({ attempt, ...failure.logContext }, 'invalid model output, retrying');
    }
  }

  router.post(
    '/v1/recipe-ideas',
    killSwitch(env.ANALYSIS_ENABLED),
    firebaseAuth(verifier),
    rateLimit(
      rateLimitStore,
      { perUser: env.PER_USER_DAILY_RECIPE_LIMIT, global: env.GLOBAL_DAILY_LIMIT },
      undefined,
      'recipes',
    ),
    async (req, res, next) => {
      try {
        const body = recipeIdeasBodySchema.safeParse(req.body);
        if (!body.success) throw new HttpError('INPUT_REJECTED');
        const ideas = await ideasWithRetry(body.data, res.locals.log);
        res.json({ ...ideas, meta: { model: claude.model, promptVersion: RECIPE_PROMPT_VERSION } });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
