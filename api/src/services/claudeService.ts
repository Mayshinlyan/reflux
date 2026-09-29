import Anthropic from '@anthropic-ai/sdk';

import { HttpError } from '../errors.js';
import {
  PHOTO_USER_MESSAGE,
  SYSTEM_PROMPT,
  TOOL_NAME,
  textUserMessage,
} from '../prompts/foodAnalysisPrompt.js';
import { mealAnalysisJsonSchema } from '../schemas.js';

export type ClaudeInput = { kind: 'text'; text: string } | { kind: 'photo'; jpeg: Buffer };

/** Content-free numbers only; safe to log. */
export type ClaudeTelemetry = {
  model: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  anthropicRequestId: string | null;
  retries: number;
};

export type ClaudeResult = {
  /** The tool input exactly as the model produced it: unvalidated. */
  raw: unknown;
  telemetry: ClaudeTelemetry;
};

/** The relay depends on this interface, so tests inject a fake and never touch the network. */
export interface ClaudeService {
  readonly model: string;
  analyze(input: ClaudeInput): Promise<ClaudeResult>;
}

export const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_TOKENS = 1200;
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 1;

/**
 * Request parameters that differ by model generation. Claude 5.x models reject forced
 * `tool_choice` and non-default sampling params with a 400 (and Sonnet 5.5 rejects disabled
 * thinking), so those are only sent where they are accepted.
 */
export function modelParams(model: string) {
  const modern = /(fable|mythos|opus-5|sonnet-5)/.test(model);
  return {
    // Forced tool use where supported; otherwise "auto" plus the prompt instruction to call the tool.
    toolChoice: modern ? ({ type: 'auto' } as const) : ({ type: 'tool', name: TOOL_NAME } as const),
    extra: /sonnet-5-5/.test(model)
      ? { thinking: { type: 'between_tools' } } // no extended thinking: cheaper and fits max_tokens
      : /opus-5-5|fable|mythos/.test(model)
        ? { output_config: { effort: 'low' } } // thinking can't be turned off on these; keep it short
        : modern
          ? {}
          : { temperature: 0.2 },
  };
}

export function createClaudeService(options: {
  apiKey: string;
  model?: string;
  client?: Anthropic;
}): ClaudeService {
  const model = options.model ?? DEFAULT_MODEL;
  // The SDK's own retries are off; we retry once ourselves so the count can be reported.
  const client =
    options.client ?? new Anthropic({ apiKey: options.apiKey, maxRetries: 0, timeout: TIMEOUT_MS });
  const params = modelParams(model);
  const inputSchema = mealAnalysisJsonSchema();

  return {
    model,
    async analyze(input) {
      const content: Anthropic.ContentBlockParam[] =
        input.kind === 'text'
          ? [{ type: 'text', text: textUserMessage(input.text) }]
          : [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: input.jpeg.toString('base64') },
              },
              { type: 'text', text: PHOTO_USER_MESSAGE },
            ];

      const request = {
        model,
        max_tokens: MAX_TOKENS,
        // The fixed system prompt + ruleset is the cached prefix (tools render before system).
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: [
          {
            name: TOOL_NAME,
            description: 'Report the structured reflux-trigger analysis of the meal. Call exactly once.',
            input_schema: inputSchema,
          },
        ],
        tool_choice: params.toolChoice,
        messages: [{ role: 'user', content }],
        ...params.extra,
      } as Anthropic.MessageCreateParamsNonStreaming;

      const started = Date.now();
      let retries = 0;
      for (;;) {
        try {
          const message = await client.messages.create(request);
          const telemetry: ClaudeTelemetry = {
            model,
            latencyMs: Date.now() - started,
            inputTokens: message.usage.input_tokens,
            outputTokens: message.usage.output_tokens,
            cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
            cacheCreationTokens: message.usage.cache_creation_input_tokens ?? 0,
            anthropicRequestId: message._request_id ?? null,
            retries,
          };
          if (message.stop_reason === 'refusal') throw new HttpError('AI_UPSTREAM_ERROR');
          const toolUse = message.content.find(
            (block) => block.type === 'tool_use' && block.name === TOOL_NAME,
          );
          if (!toolUse || toolUse.type !== 'tool_use' || message.stop_reason === 'max_tokens') {
            throw new HttpError('AI_INVALID_OUTPUT');
          }
          return { raw: toolUse.input, telemetry };
        } catch (error) {
          if (error instanceof HttpError) throw error;
          if (retries < MAX_RETRIES && isRetryable(error)) {
            retries += 1;
            continue;
          }
          throw toHttpError(error);
        }
      }
    },
  };
}

function isRetryable(error: unknown): boolean {
  if (error instanceof Anthropic.APIConnectionError) return true; // includes timeouts
  return (
    error instanceof Anthropic.APIError &&
    typeof error.status === 'number' &&
    (error.status === 429 || error.status >= 500)
  );
}

function toHttpError(error: unknown): HttpError {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new HttpError('AI_TIMEOUT');
  return new HttpError('AI_UPSTREAM_ERROR');
}

/** Used when no API key is configured: analysis reports busy instead of crashing the process. */
export function createUnavailableClaudeService(model = DEFAULT_MODEL): ClaudeService {
  return {
    model,
    async analyze() {
      throw new HttpError('SERVICE_BUSY');
    },
  };
}
