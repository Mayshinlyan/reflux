import { Writable } from 'node:stream';

import { createApp } from '../src/app.js';
import { type Env, loadEnv } from '../src/config/env.js';
import { type FeedbackStore, InMemoryFeedbackStore } from '../src/lib/feedbackStore.js';
import { createLogger } from '../src/lib/logger.js';
import { InMemoryRateLimitStore, type RateLimitStore } from '../src/lib/rateLimitStore.js';
import type { InsightInput, RecipeIdeasInput } from '../src/schemas.js';
import type { ClaudeInput, ClaudeResult, ClaudeService } from '../src/services/claudeService.js';
import type { TokenVerifier } from '../src/services/tokenVerifier.js';

/** A logger that writes JSON lines into memory so tests can assert on log output. */
export function memoryLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(...chunk.toString().split('\n').filter(Boolean));
      callback();
    },
  });
  const logger = createLogger({ level: 'debug' }, stream);
  return { logger, lines, parsed: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>) };
}

export const VALID_TOKEN = 'valid-token-for-user-1';

/** Accepts tokens of the form `valid-token-for-<uid>`. */
export const fakeVerifier: TokenVerifier = {
  async verify(token) {
    const match = /^valid-token-for-(.+)$/.exec(token);
    if (!match?.[1]) throw new Error('bad token');
    return { uid: match[1] };
  },
};

export const goodAnalysis = {
  isFood: true,
  mealName: 'Mint tea',
  items: [
    {
      name: 'Mint tea',
      ingredients: [{ name: 'peppermint', matchedCategories: ['mint'] }],
      verdict: 'caution',
      reasoning: 'Peppermint may relax the lower esophageal sphincter.',
      matchedTriggers: [{ category: 'mint', evidence: 'peppermint leaves' }],
    },
  ],
  overall: { verdict: 'caution', confidence: 'high', reasoning: 'Contains mint.' },
};

export const goodInsight = {
  tone: 'nudge',
  bellieLine: 'Easy on the spice tonight?',
  summary: 'Spicy tacos late, then heartburn. Chili and tomato keep showing up.',
  tips: ['Have spicy food earlier in the day.', 'Try a milder salsa.'],
};

export const goodFridge = { items: ['Eggs', 'rice', 'Kimchi  ', 'eggs', 'spinach'] };

export const goodRecipes = {
  recipes: [
    {
      title: 'Kimchi egg fried rice',
      minutes: 20,
      serves: 2,
      why: 'Soft rice and egg are easy on the stomach, and the kimchi is rinsed to tone down the acid.',
      tip: 'Eat it warm, not hot.',
      ingredients: ['1 1/2 cups cooked rice', '2 eggs', '1/2 cup kimchi, rinsed', '1 tbsp sesame oil'],
      steps: ['Rinse and chop the kimchi.', 'Stir-fry it in the oil.', 'Add the rice, then the eggs.'],
    },
    {
      title: 'Tofu soondubu stew',
      minutes: 25,
      serves: 2,
      why: 'Silky tofu in a mild broth, with the chili cut right back.',
      tip: '',
      ingredients: ['1 block soft tofu', '2 cups mild broth', '1 scallion'],
      steps: ['Heat the broth.', 'Add the tofu in spoonfuls.', 'Simmer for 10 minutes.'],
    },
    {
      title: 'Miso salmon bowl',
      minutes: 25,
      serves: 2,
      why: 'Baked fish and rice are gentle, and miso adds flavor without heat.',
      tip: 'Sit upright for a while after eating.',
      ingredients: ['2 salmon fillets (4 oz each)', '1 tbsp miso', '1 cup cooked rice'],
      steps: ['Spread the miso on the salmon.', 'Bake for 12 minutes.', 'Serve over the rice.'],
    },
  ],
};

const telemetry = {
  model: 'claude-test-model',
  latencyMs: 12,
  inputTokens: 100,
  outputTokens: 50,
  cacheReadTokens: 80,
  cacheCreationTokens: 0,
  anthropicRequestId: 'req_test',
  retries: 0,
};

export function fakeClaude(
  respond: (input: ClaudeInput) => unknown | Promise<unknown> = () => goodAnalysis,
  respondInsight: (input: InsightInput) => unknown | Promise<unknown> = () => goodInsight,
  respondRecipes: (input: RecipeIdeasInput) => unknown | Promise<unknown> = () => goodRecipes,
  respondFridge: (input: { jpegs: Buffer[] }) => unknown | Promise<unknown> = () => goodFridge,
) {
  const calls: ClaudeInput[] = [];
  const insightCalls: InsightInput[] = [];
  const recipeCalls: RecipeIdeasInput[] = [];
  const fridgeCalls: { jpegs: Buffer[] }[] = [];
  const service: ClaudeService = {
    model: 'claude-test-model',
    async analyze(input): Promise<ClaudeResult> {
      calls.push(input);
      return { raw: await respond(input), telemetry };
    },
    async insight(input): Promise<ClaudeResult> {
      insightCalls.push(input);
      return { raw: await respondInsight(input), telemetry };
    },
    async recipes(input): Promise<ClaudeResult> {
      recipeCalls.push(input);
      return { raw: await respondRecipes(input), telemetry };
    },
    async fridge(input): Promise<ClaudeResult> {
      fridgeCalls.push(input);
      return { raw: await respondFridge(input), telemetry };
    },
  };
  return { service, calls, insightCalls, recipeCalls, fridgeCalls };
}

export function testApp(
  overrides: Partial<Record<keyof Env, string>> = {},
  deps: {
    claude?: ClaudeService;
    rateLimitStore?: RateLimitStore;
    verifier?: TokenVerifier;
    feedbackStore?: FeedbackStore;
  } = {},
) {
  const env = loadEnv({ NODE_ENV: 'test', ...overrides });
  const logs = memoryLogger();
  const claude = fakeClaude();
  const feedbackStore = new InMemoryFeedbackStore();
  const app = createApp({
    env,
    logger: logs.logger,
    verifier: deps.verifier ?? fakeVerifier,
    rateLimitStore: deps.rateLimitStore ?? new InMemoryRateLimitStore(),
    claude: deps.claude ?? claude.service,
    feedbackStore: deps.feedbackStore ?? feedbackStore,
  });
  return { app, logs, claudeCalls: claude.calls, feedback: feedbackStore.entries };
}
