import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

/** An id that may be left empty: the deploy passes every variable, set or not. */
const optionalId = z.preprocess((value) => (value === '' ? undefined : value), z.string().min(1).optional());

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(8080),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
    /** Kill switch: `false` makes every analysis request return SERVICE_BUSY without calling Claude. */
    ANALYSIS_ENABLED: booleanString.default(true),
    PER_USER_DAILY_LIMIT: z.coerce.number().int().positive().default(30),
    GLOBAL_DAILY_LIMIT: z.coerce.number().int().positive().default(300),
    /** Bellie's day and week summaries have their own per-user cap, so they never use up meal checks. */
    PER_USER_DAILY_INSIGHT_LIMIT: z.coerce.number().int().positive().default(20),
    /**
     * Kitchen recipe rounds (three ideas each) per person per day. The app stops at 10 a day, so this leaves room for
     * "Try again" after a failure without the relay refusing first. Its own counter, so it never uses up meal checks.
     */
    PER_USER_DAILY_RECIPE_LIMIT: z.coerce.number().int().positive().default(15),
    /**
     * Kitchen ingredient edits (swap, remove, add) per person per day. Each rewrites one recipe, a smaller call than a
     * round of ideas, and it has its own counter so it never uses up rounds or meal checks.
     */
    PER_USER_DAILY_ADJUST_LIMIT: z.coerce.number().int().positive().default(40),
    /** Feedback messages per person per day; no AI cost, so it never counts toward the AI breaker above. */
    PER_USER_DAILY_FEEDBACK_LIMIT: z.coerce.number().int().positive().default(5),
    /** A daily ceiling on feedback from everyone, because anonymous sign-in makes a per-person cap easy to dodge. */
    GLOBAL_DAILY_FEEDBACK_LIMIT: z.coerce.number().int().positive().default(500),
    /** Injected from Secret Manager in the cloud. Never logged. Not needed once workload identity federation is on. */
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    /**
     * Workload identity federation (no stored key): the Cloud Run service account's Google identity token is
     * exchanged for a short-lived Anthropic token. These are identifiers, not secrets. When the rule id is set,
     * federation is used even if an API key is also present.
     */
    ANTHROPIC_FEDERATION_RULE_ID: optionalId,
    ANTHROPIC_ORGANIZATION_ID: optionalId,
    ANTHROPIC_SERVICE_ACCOUNT_ID: optionalId,
    ANTHROPIC_WORKSPACE_ID: optionalId,
    ANTHROPIC_MODEL: z.string().min(1).default('claude-sonnet-5-5'),
    /** Optional: Application Default Credentials normally supply the project. */
    FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.ANTHROPIC_FEDERATION_RULE_ID && !env.ANTHROPIC_ORGANIZATION_ID) {
      ctx.addIssue({
        code: 'custom',
        path: ['ANTHROPIC_ORGANIZATION_ID'],
        message: 'required when ANTHROPIC_FEDERATION_RULE_ID is set',
      });
    }
    // Without the rule id the other ids are ignored and the relay would silently fall back to the key.
    if (!env.ANTHROPIC_FEDERATION_RULE_ID) {
      for (const name of [
        'ANTHROPIC_ORGANIZATION_ID',
        'ANTHROPIC_SERVICE_ACCOUNT_ID',
        'ANTHROPIC_WORKSPACE_ID',
      ] as const) {
        if (env[name]) {
          ctx.addIssue({ code: 'custom', path: [name], message: 'requires ANTHROPIC_FEDERATION_RULE_ID' });
        }
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    // Report which variables are invalid, never their values.
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid environment configuration: ${fields}`);
  }
  return parsed.data;
}
