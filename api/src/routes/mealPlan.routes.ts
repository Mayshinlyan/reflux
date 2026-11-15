import { type NextFunction, type Request, type Response, Router } from 'express';
import type { Logger } from 'pino';

import { HttpError } from '../errors.js';
import { firebaseAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { MEAL_PLAN_PROMPT_VERSION } from '../prompts/mealPlanPrompt.js';
import {
  issueCodes,
  issuePaths,
  type MealPlan,
  type MealPlanInput,
  mealPlanBodySchema,
  mealPlanSchema,
} from '../schemas.js';
import type { AnalyzeDeps } from './analyze.routes.js';
import { breaksNeverEat } from './recipes.routes.js';

/** The same kill switch as meal checks: answers SERVICE_BUSY before any auth, quota or Claude work happens. */
function killSwitch(enabled: boolean) {
  return (_req: Request, _res: Response, next: NextFunction) =>
    next(enabled ? undefined : new HttpError('SERVICE_BUSY'));
}

/** A bad model answer (truncated, no tool call, off-schema, a gap in the plan or an unsafe dish) is usually a one-off. */
const MAX_ATTEMPTS = 2;

/**
 * True when the plan covers exactly the meals that were asked for, every meal points at a dish that exists, and dish
 * ids are unique. Anything else would leave the app with a hole or a dangling pointer. A dish no meal uses is harmless
 * (see `withoutUnusedDishes`), so it does not fail the plan.
 */
export function planFitsRequest(plan: MealPlan, input: MealPlanInput): boolean {
  const ids = new Set(plan.dishes.map((dish) => dish.id));
  if (ids.size !== plan.dishes.length) return false;
  const asked = new Set(input.slots.map((slot) => `${slot.day}|${slot.slot}`));
  const planned = new Set(plan.meals.map((meal) => `${meal.day}|${meal.slot}`));
  if (planned.size !== plan.meals.length || planned.size !== asked.size) return false;
  for (const key of planned) if (!asked.has(key)) return false;
  return plan.meals.every((meal) => ids.has(meal.dish));
}

/** The plan without any dish that no meal points at, so the app never keeps a recipe it will not show. */
export function withoutUnusedDishes(plan: MealPlan): MealPlan {
  const used = new Set(plan.meals.map((meal) => meal.dish));
  return { ...plan, dishes: plan.dishes.filter((dish) => used.has(dish.id)) };
}

/** A week plan for the Kitchen (POST /v1/meal-plan), on its own daily allowance per person. */
export function mealPlanRoutes({ env, verifier, rateLimitStore, claude }: AnalyzeDeps) {
  const router = Router();

  async function planWithRetry(input: MealPlanInput, log: Logger): Promise<MealPlan> {
    for (let attempt = 1; ; attempt += 1) {
      let failure: HttpError;
      try {
        const { raw, telemetry } = await claude.mealPlan(input);
        const parsed = mealPlanSchema.safeParse(raw);
        // Telemetry is numbers and ids only. Zod failures are logged as paths and codes, never values.
        log.info(
          {
            ...telemetry,
            attempt,
            kind: 'meal-plan',
            status: parsed.success ? 'ok' : 'invalid_output',
            zodPaths: parsed.success ? undefined : issuePaths(parsed.error),
            zodCodes: parsed.success ? undefined : issueCodes(parsed.error),
          },
          'claude call completed',
        );
        if (parsed.success) {
          const unsafe = parsed.data.dishes.filter((dish) => breaksNeverEat(dish, input.avoid)).length;
          if (unsafe > 0) log.warn({ attempt, unsafe }, 'plan dropped by never-eat check');
          // A plan with one unsafe dish is thrown away whole: meals point at dishes, so one cannot be cut out.
          else if (planFitsRequest(parsed.data, input)) return withoutUnusedDishes(parsed.data);
          else log.warn({ attempt }, 'plan does not cover the meals asked for');
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
    '/v1/meal-plan',
    killSwitch(env.ANALYSIS_ENABLED),
    firebaseAuth(verifier),
    rateLimit(
      rateLimitStore,
      { perUser: env.PER_USER_DAILY_PLAN_LIMIT, global: env.GLOBAL_DAILY_LIMIT },
      undefined,
      'meal-plan',
    ),
    async (req, res, next) => {
      try {
        const body = mealPlanBodySchema.safeParse(req.body);
        if (!body.success) throw new HttpError('INPUT_REJECTED');
        const plan = await planWithRetry(body.data, res.locals.log);
        res.json({ ...plan, meta: { model: claude.model, promptVersion: MEAL_PLAN_PROMPT_VERSION } });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
