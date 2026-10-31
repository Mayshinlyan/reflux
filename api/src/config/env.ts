import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  /** Kill switch: `false` makes every analysis request return SERVICE_BUSY without calling Claude. */
  ANALYSIS_ENABLED: booleanString.default(true),
  PER_USER_DAILY_LIMIT: z.coerce.number().int().positive().default(30),
  GLOBAL_DAILY_LIMIT: z.coerce.number().int().positive().default(300),
  /** Bellie's day and week summaries have their own per-user cap, so they never use up meal checks. */
  PER_USER_DAILY_INSIGHT_LIMIT: z.coerce.number().int().positive().default(20),
  /** Feedback messages per person per day; no AI cost, so it never counts toward the AI breaker above. */
  PER_USER_DAILY_FEEDBACK_LIMIT: z.coerce.number().int().positive().default(5),
  /** A daily ceiling on feedback from everyone, because anonymous sign-in makes a per-person cap easy to dodge. */
  GLOBAL_DAILY_FEEDBACK_LIMIT: z.coerce.number().int().positive().default(500),
  /** Injected from Secret Manager in the cloud. Never logged. */
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().min(1).default('claude-sonnet-5-5'),
  /** Optional: Application Default Credentials normally supply the project. */
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
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
