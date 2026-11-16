import { Writable } from 'node:stream';

import { createApp } from '../src/app.js';
import { type Env, loadEnv } from '../src/config/env.js';
import { type FeedbackStore, InMemoryFeedbackStore } from '../src/lib/feedbackStore.js';
import { createLogger } from '../src/lib/logger.js';
import { InMemoryRateLimitStore, type RateLimitStore } from '../src/lib/rateLimitStore.js';
import type { SpeechToText } from '../src/services/speechToText.js';
import type {
  InsightInput,
  MealPlanInput,
  PrepPlanInput,
  RecipeIdeasInput,
  VoiceContext,
} from '../src/schemas.js';
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

export const goodVoice = {
  meals: [{ label: 'dinner', foods: ['Pasta', 'Glass of wine'], at: '2026-11-13T20:00:00-08:00' }],
  symptoms: ['heartburn'],
  at: null,
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

/** A cook-once plan: two dishes covering three meals (the miso salmon only on the first day, where it keeps). */
export const goodPlan = {
  dishes: [
    {
      id: 'd1',
      title: 'Gochujang chicken bowls',
      minutes: 60,
      serves: 4,
      why: 'Lean chicken and soft rice, with the chili cut right back.',
      tip: 'Reheat until just warm.',
      keepsDays: 4,
      ingredients: ['1 1/2 lb chicken thighs', '2 cups rice', '1 tbsp mild gochujang'],
      steps: ['Cook the rice.', 'Poach the chicken.', 'Shred it and mix with the sauce.'],
    },
    {
      id: 'd2',
      title: 'Miso salmon with rice',
      minutes: 30,
      serves: 2,
      why: 'Baked fish and rice are gentle, and miso adds flavor without heat.',
      tip: '',
      keepsDays: 1,
      ingredients: ['2 salmon fillets (4 oz each)', '1 tbsp miso', '1 cup cooked rice'],
      steps: ['Spread the miso on the salmon.', 'Bake for 12 minutes.', 'Serve over the rice.'],
    },
  ],
  meals: [
    { day: '2026-11-16', slot: 'lunch', dish: 'd1' },
    { day: '2026-11-16', slot: 'dinner', dish: 'd2' },
    { day: '2026-11-17', slot: 'lunch', dish: 'd1' },
  ],
};

/** A prep session for goodPlan's two dishes: oven first for both, then each dish's own steps. */
export const goodPrep = {
  start: [
    { text: 'Heat the oven to 425 F', feeds: ['d1', 'd2'] },
    { text: 'Cook one big pot of rice', feeds: ['d1', 'd2'] },
  ],
  dishes: [
    { dish: 'd1', steps: ['Poach the chicken, then shred it', 'Toss it with the sauce'] },
    { dish: 'd2', steps: ['Spread the miso on the salmon', 'Bake for 12 minutes'] },
  ],
  finish: [{ text: 'Cool everything, then pack and label', feeds: ['d1', 'd2'] }],
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
  respondVoice: (input: { transcript: string; context: VoiceContext }) => unknown | Promise<unknown> = () =>
    goodVoice,
  respondPlan: (input: MealPlanInput) => unknown | Promise<unknown> = () => goodPlan,
  respondPrep: (input: PrepPlanInput) => unknown | Promise<unknown> = () => goodPrep,
) {
  const calls: ClaudeInput[] = [];
  const insightCalls: InsightInput[] = [];
  const recipeCalls: RecipeIdeasInput[] = [];
  const planCalls: MealPlanInput[] = [];
  const prepCalls: PrepPlanInput[] = [];
  const fridgeCalls: { jpegs: Buffer[] }[] = [];
  const voiceCalls: { transcript: string; context: VoiceContext }[] = [];
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
    async mealPlan(input): Promise<ClaudeResult> {
      planCalls.push(input);
      return { raw: await respondPlan(input), telemetry };
    },
    async prepPlan(input): Promise<ClaudeResult> {
      prepCalls.push(input);
      return { raw: await respondPrep(input), telemetry };
    },
    async fridge(input): Promise<ClaudeResult> {
      fridgeCalls.push(input);
      return { raw: await respondFridge(input), telemetry };
    },
    async voiceLog(input): Promise<ClaudeResult> {
      voiceCalls.push(input);
      return { raw: await respondVoice(input), telemetry };
    },
  };
  return { service, calls, insightCalls, recipeCalls, planCalls, prepCalls, fridgeCalls, voiceCalls };
}

/** A speech service that "hears" fixed words and remembers what it was given. */
export function fakeSpeech(words = 'I had pasta and a glass of wine around eight and my chest is burning') {
  const calls: { bytes: number; mimeType: string; hint: string }[] = [];
  const service: SpeechToText = {
    async transcribe(audio, mimeType, hint) {
      calls.push({ bytes: audio.length, mimeType, hint });
      return words;
    },
  };
  return { service, calls };
}

export function testApp(
  overrides: Partial<Record<keyof Env, string>> = {},
  deps: {
    claude?: ClaudeService;
    rateLimitStore?: RateLimitStore;
    verifier?: TokenVerifier;
    feedbackStore?: FeedbackStore;
    speech?: SpeechToText;
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
    speech: deps.speech ?? fakeSpeech().service,
  });
  return { app, logs, claudeCalls: claude.calls, feedback: feedbackStore.entries };
}
