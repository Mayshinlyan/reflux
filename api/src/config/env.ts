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
     * Week plans per person per day (each is the longest answer we ask for). The app asks once to make a plan and
     * once per redo, so this leaves room for a few redos and a "Try again" after a failure. Its own counter.
     */
    PER_USER_DAILY_PLAN_LIMIT: z.coerce.number().int().positive().default(8),
    PER_USER_DAILY_PREP_LIMIT: z.coerce.number().int().positive().default(20),
    /** Fridge scans (one to three photos each) per person per day. Its own counter; each scan is an image call. */
    PER_USER_DAILY_FRIDGE_LIMIT: z.coerce.number().int().positive().default(5),
    /** Spoken logs per person per day. Its own counter; each one is a speech call plus an AI call. */
    PER_USER_DAILY_VOICE_LIMIT: z.coerce.number().int().positive().default(20),
    /**
     * The speech-to-text provider: any service with an OpenAI-style `/audio/transcriptions` endpoint (hosted
     * Whisper, OpenAI, or our own). Without a key, spoken logs report busy. The key is a secret; never logged.
     */
    STT_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
    // The deploy passes it even when the secret is unset (an empty string), which must not stop the relay starting.
    STT_API_KEY: optionalId,
    STT_MODEL: z.string().min(1).default('whisper-1'),
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
