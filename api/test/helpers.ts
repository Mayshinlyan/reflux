import { Writable } from 'node:stream';

import { createApp } from '../src/app.js';
import { type Env, loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import { InMemoryRateLimitStore, type RateLimitStore } from '../src/lib/rateLimitStore.js';
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

export function fakeClaude(respond: (input: ClaudeInput) => unknown | Promise<unknown> = () => goodAnalysis) {
  const calls: ClaudeInput[] = [];
  const service: ClaudeService = {
    model: 'claude-test-model',
    async analyze(input): Promise<ClaudeResult> {
      calls.push(input);
      return {
        raw: await respond(input),
        telemetry: {
          model: 'claude-test-model',
          latencyMs: 12,
          inputTokens: 100,
          outputTokens: 50,
          cacheReadTokens: 80,
          cacheCreationTokens: 0,
          anthropicRequestId: 'req_test',
          retries: 0,
        },
      };
    },
  };
  return { service, calls };
}

export function testApp(
  overrides: Partial<Record<keyof Env, string>> = {},
  deps: { claude?: ClaudeService; rateLimitStore?: RateLimitStore; verifier?: TokenVerifier } = {},
) {
  const env = loadEnv({ NODE_ENV: 'test', ...overrides });
  const logs = memoryLogger();
  const claude = fakeClaude();
  const app = createApp({
    env,
    logger: logs.logger,
    verifier: deps.verifier ?? fakeVerifier,
    rateLimitStore: deps.rateLimitStore ?? new InMemoryRateLimitStore(),
    claude: deps.claude ?? claude.service,
  });
  return { app, logs, claudeCalls: claude.calls };
}
