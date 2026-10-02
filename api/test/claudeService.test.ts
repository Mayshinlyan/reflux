import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { CATEGORIES, ruleset } from '../src/config/ruleset.js';
import {
  PROMPT_VERSION,
  photoUserMessage,
  SYSTEM_PROMPT,
  TOOL_NAME,
  textUserMessage,
} from '../src/prompts/foodAnalysisPrompt.js';
import {
  createClaudeService,
  createUnavailableClaudeService,
  modelParams,
} from '../src/services/claudeService.js';
import { mealAnalysisSchema } from '../src/schemas.js';
import { goodAnalysis } from './helpers.js';

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg_1',
    _request_id: 'req_abc',
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', id: 'tu_1', name: TOOL_NAME, input: goodAnalysis }],
    usage: {
      input_tokens: 20,
      output_tokens: 300,
      cache_read_input_tokens: 1500,
      cache_creation_input_tokens: 0,
    },
    ...overrides,
  };
}

function serviceWith(create: ReturnType<typeof vi.fn>, model?: string) {
  const client = { messages: { create } } as unknown as Anthropic;
  return createClaudeService({ apiKey: 'test-key', model, client, retryDelayMs: 0 });
}

describe('claudeService request', () => {
  it('makes one call with a cached system prompt, the analysis tool and a delimited user message', async () => {
    const create = vi.fn().mockResolvedValue(message());
    const result = await serviceWith(create).analyze({ kind: 'text', text: 'mint tea' });

    expect(create).toHaveBeenCalledTimes(1);
    const request = create.mock.calls[0]?.[0];
    expect(request.model).toBe('claude-sonnet-5-5');
    // Room for big multi-item dishes (dim sum ran past 1000 tokens), but still bounded.
    expect(request.max_tokens).toBeGreaterThanOrEqual(2500);
    expect(request.max_tokens).toBeLessThanOrEqual(4000);
    expect(request.system).toEqual([
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ]);
    expect(request.tools).toHaveLength(1);
    expect(request.tools[0].name).toBe(TOOL_NAME);
    expect(request.messages).toHaveLength(1);
    expect(request.messages[0].content[0].text).toContain(
      '<food_description>\nmint tea\n</food_description>',
    );
    expect(result.raw).toEqual(goodAnalysis);
  });

  it('sends photos as a base64 JPEG image block', async () => {
    const create = vi.fn().mockResolvedValue(message());
    await serviceWith(create).analyze({ kind: 'photo', jpeg: Buffer.from('jpegbytes') });

    const [image, text] = create.mock.calls[0]![0].messages[0].content as { type: string }[];
    expect(image).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: Buffer.from('jpegbytes').toString('base64') },
    });
    expect(text?.type).toBe('text');
  });

  it('wraps user details in delimiters for text and photo, and omits the block when absent', async () => {
    const create = vi.fn().mockResolvedValue(message());
    const service = serviceWith(create);
    await service.analyze({ kind: 'text', text: 'soup', details: 'pumpkin, no cream' });
    await service.analyze({ kind: 'photo', jpeg: Buffer.from('j'), details: 'homemade' });
    await service.analyze({ kind: 'photo', jpeg: Buffer.from('j') });

    const texts = create.mock.calls.map((call) => {
      const content = call[0].messages[0].content as { type: string; text: string }[];
      return content.find((block) => block.type === 'text')!.text;
    });
    expect(texts[0]).toContain('<user_details>\npumpkin, no cream\n</user_details>');
    expect(texts[1]).toContain('<user_details>\nhomemade\n</user_details>');
    expect(texts[2]).not.toContain('user_details');
  });

  it('keeps the system prompt free of per-request data so the cache prefix is stable', async () => {
    expect(SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}T/); // no timestamps
    expect(SYSTEM_PROMPT).toContain(ruleset.version);
    for (const category of CATEGORIES) expect(SYSTEM_PROMPT).toContain(category);
  });

  it('tells the model to ignore instructions in the food description and never give medication advice', () => {
    expect(SYSTEM_PROMPT).toMatch(/untrusted DATA/);
    expect(SYSTEM_PROMPT).toMatch(/<food_description>/);
    expect(SYSTEM_PROMPT).toMatch(/<user_details>/);
    expect(SYSTEM_PROMPT).toMatch(/Never give medication/);
  });

  it('declares the tool schema with the ruleset categories and no extra properties', async () => {
    const create = vi.fn().mockResolvedValue(message());
    await serviceWith(create).analyze({ kind: 'text', text: 'tea' });

    const schema = create.mock.calls[0]?.[0].tools[0].input_schema;
    expect(schema.type).toBe('object');
    expect(schema.additionalProperties).toBe(false);
    expect(JSON.stringify(schema)).toContain('raw_garlic_onion');
    expect(JSON.stringify(schema)).not.toContain('$schema');
  });
});

describe('claudeService telemetry and errors', () => {
  it('reports model, latency, tokens including cache hits, request id and retries', async () => {
    const create = vi.fn().mockResolvedValue(message());
    const { telemetry } = await serviceWith(create).analyze({ kind: 'text', text: 'tea' });

    expect(telemetry).toMatchObject({
      model: 'claude-sonnet-5-5',
      inputTokens: 20,
      outputTokens: 300,
      cacheReadTokens: 1500,
      cacheCreationTokens: 0,
      anthropicRequestId: 'req_abc',
      retries: 0,
    });
    expect(telemetry.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('retries once on a 5xx and reports it', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Anthropic.InternalServerError(500, {}, 'boom', new Headers()))
      .mockResolvedValueOnce(message());
    const { telemetry } = await serviceWith(create).analyze({ kind: 'text', text: 'tea' });

    expect(create).toHaveBeenCalledTimes(2);
    expect(telemetry.retries).toBe(1);
  });

  it('gives up after one retry with AI_UPSTREAM_ERROR', async () => {
    const create = vi
      .fn()
      .mockRejectedValue(new Anthropic.InternalServerError(500, {}, 'boom', new Headers()));
    await expect(serviceWith(create).analyze({ kind: 'text', text: 'tea' })).rejects.toMatchObject({
      code: 'AI_UPSTREAM_ERROR',
    });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('maps timeouts to AI_TIMEOUT after the retry', async () => {
    const create = vi.fn().mockRejectedValue(new Anthropic.APIConnectionTimeoutError());
    await expect(serviceWith(create).analyze({ kind: 'text', text: 'tea' })).rejects.toMatchObject({
      code: 'AI_TIMEOUT',
    });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('does not retry client errors', async () => {
    const create = vi.fn().mockRejectedValue(new Anthropic.BadRequestError(400, {}, 'bad', new Headers()));
    await expect(serviceWith(create).analyze({ kind: 'text', text: 'tea' })).rejects.toMatchObject({
      code: 'AI_UPSTREAM_ERROR',
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'no tool call',
      message({ content: [{ type: 'text', text: 'Sure, here you go' }], stop_reason: 'end_turn' }),
    ],
    ['a truncated response', message({ stop_reason: 'max_tokens' })],
  ])('returns AI_INVALID_OUTPUT for %s', async (_name, response) => {
    const create = vi.fn().mockResolvedValue(response);
    await expect(serviceWith(create).analyze({ kind: 'text', text: 'tea' })).rejects.toMatchObject({
      code: 'AI_INVALID_OUTPUT',
    });
  });

  it('logs why an answer was rejected, without content', async () => {
    const create = vi.fn().mockResolvedValue(message({ stop_reason: 'max_tokens' }));
    const error = await serviceWith(create)
      .analyze({ kind: 'text', text: 'dim sum' })
      .catch((e: unknown) => e);

    expect(error).toMatchObject({
      code: 'AI_INVALID_OUTPUT',
      logContext: { stopReason: 'max_tokens', outputTokens: 300, anthropicRequestId: 'req_abc' },
    });
  });

  it('treats a refusal as an upstream error', async () => {
    const create = vi.fn().mockResolvedValue(message({ stop_reason: 'refusal' }));
    await expect(serviceWith(create).analyze({ kind: 'text', text: 'tea' })).rejects.toMatchObject({
      code: 'AI_UPSTREAM_ERROR',
    });
  });

  it('never puts the API key or food text in a thrown error', async () => {
    const create = vi.fn().mockRejectedValue(new Error('secret pizza test-key'));
    const error = await serviceWith(create)
      .analyze({ kind: 'text', text: 'tea' })
      .catch((e: unknown) => e);
    expect(String((error as Error).message)).not.toMatch(/pizza|test-key/);
  });

  it('unavailable service (no API key) reports SERVICE_BUSY', async () => {
    await expect(createUnavailableClaudeService().analyze({ kind: 'text', text: 'x' })).rejects.toMatchObject(
      {
        code: 'SERVICE_BUSY',
      },
    );
  });
});

describe('modelParams', () => {
  it('avoids forced tool use and non-default sampling on Claude 5.x models, which reject them', () => {
    for (const model of ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1']) {
      const params = modelParams(model);
      expect(params.toolChoice).toEqual({ type: 'auto' });
      expect(params.extra).not.toHaveProperty('temperature');
    }
  });

  it('turns thinking off for Sonnet 5.5 and keeps effort low where thinking cannot be disabled', () => {
    expect(modelParams('claude-sonnet-5-5').extra).toEqual({ thinking: { type: 'between_tools' } });
    expect(modelParams('claude-opus-5-5').extra).toEqual({ output_config: { effort: 'low' } });
  });

  it('forces the tool and uses a low temperature on Haiku 4.5', () => {
    const params = modelParams('claude-haiku-4-5-20251001');
    expect(params.toolChoice).toEqual({ type: 'tool', name: TOOL_NAME });
    expect(params.extra).toEqual({ temperature: 0.2 });
  });

  it('tells the model a user-stated portion, only when it is not regular', () => {
    expect(SYSTEM_PROMPT).toContain('<portion>');
    expect(textUserMessage('soup', undefined, 'large')).toContain('<portion>large</portion>');
    expect(photoUserMessage(undefined, 'small')).toContain('<portion>small</portion>');
    expect(textUserMessage('soup', undefined, 'regular')).not.toContain('<portion>');
    expect(textUserMessage('soup')).not.toContain('<portion>');
  });

  it('exposes the prompt version used in meta', () => {
    expect(PROMPT_VERSION).toMatch(/^food-analysis-v\d+$/);
  });

  it('asks for main ingredients only, keeping every trigger ingredient', () => {
    // v2 changed the prompt text, so the version must have moved past v1 (results record it).
    expect(PROMPT_VERSION).not.toBe('food-analysis-v1');
    expect(SYSTEM_PROMPT).toContain('main ingredients only');
    expect(SYSTEM_PROMPT).toContain('at most 8 per item');
    expect(SYSTEM_PROMPT).toContain('every ingredient that matches a category');
    expect(SYSTEM_PROMPT).not.toContain('20 ingredients');
  });

  it('keeps the schema tolerant of long lists so a chatty answer is not rejected', () => {
    // The prompt asks for at most 8; the schema stays at 20 so an over-long list is not a 502.
    const ingredients = Array.from({ length: 12 }, (_, i) => ({ name: `item ${i}`, matchedCategories: [] }));
    const analysis = { ...goodAnalysis, items: [{ ...goodAnalysis.items[0], ingredients }] };
    expect(mealAnalysisSchema.safeParse(analysis).success).toBe(true);
  });
});
