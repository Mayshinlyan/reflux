import Anthropic from '@anthropic-ai/sdk';

import { type Condition } from '../config/ruleset.js';
import { HttpError } from '../errors.js';
import {
  photoUserMessage,
  SYSTEM_PROMPT,
  TOOL_NAME,
  textUserMessage,
} from '../prompts/foodAnalysisPrompt.js';
import { FRIDGE_SYSTEM_PROMPT, FRIDGE_TOOL_NAME, FRIDGE_USER_MESSAGE } from '../prompts/fridgePrompt.js';
import { INSIGHT_SYSTEM_PROMPT, INSIGHT_TOOL_NAME, insightUserMessage } from '../prompts/insightPrompt.js';
import { VOICE_SYSTEM_PROMPT, VOICE_TOOL_NAME, voiceUserMessage } from '../prompts/voicePrompt.js';
import { RECIPE_SYSTEM_PROMPT, RECIPE_TOOL_NAME, recipeUserMessage } from '../prompts/recipePrompt.js';
import {
  fridgeScanJsonSchema,
  type InsightInput,
  insightJsonSchema,
  mealAnalysisJsonSchema,
  type Portion,
  type RecipeIdeasInput,
  recipeIdeasJsonSchema,
  type VoiceContext,
  voiceExtractJsonSchema,
} from '../schemas.js';

export type ClaudeInput =
  | { kind: 'text'; text: string; details?: string; portion?: Portion; conditions?: Condition[] }
  | { kind: 'photo'; jpeg: Buffer; details?: string; portion?: Portion; conditions?: Condition[] };

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
  /** Bellie's day or week summary of what the person logged. */
  insight(input: InsightInput): Promise<ClaudeResult>;
  /** Three recipe ideas that go easy on the person's belly (the Kitchen). */
  recipes(input: RecipeIdeasInput): Promise<ClaudeResult>;
  /** The food names in one to three sanitized fridge photos (the Kitchen's "My fridge"). */
  fridge(input: { jpegs: Buffer[] }): Promise<ClaudeResult>;
  /** The foods, symptoms and time in a spoken log's transcript. */
  voiceLog(input: { transcript: string; context: VoiceContext }): Promise<ClaudeResult>;
}

export const DEFAULT_MODEL = 'claude-sonnet-5-5';
// Multi-item dishes (dim sum, a full plate) run past 1000 output tokens; a lower cap truncates them.
const MAX_TOKENS = 3000;
// Three full recipes (ingredients and steps) are longer than a meal check, so they get more room and more time.
const RECIPE_MAX_TOKENS = 5000;
const RECIPE_TIMEOUT_MS = 60_000;
// Up to three photos in, a list of names out: longer than a meal check, much shorter than recipes.
const FRIDGE_TIMEOUT_MS = 45_000;
const TIMEOUT_MS = 30_000;
/** The SDK's own retries are off; we retry once ourselves so the count can be reported. */
export const CLIENT_SETTINGS = { maxRetries: 0, timeout: TIMEOUT_MS };
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 750;

/**
 * Request parameters that differ by model generation. Claude 5.x models reject forced
 * `tool_choice` and non-default sampling params with a 400 (and Sonnet 5.5 rejects disabled
 * thinking), so those are only sent where they are accepted.
 */
export function modelParams(model: string, toolName: string = TOOL_NAME) {
  const modern = /(fable|mythos|opus-5|sonnet-5)/.test(model);
  return {
    // Forced tool use where supported; otherwise "auto" plus the prompt instruction to call the tool.
    toolChoice: modern ? ({ type: 'auto' } as const) : ({ type: 'tool', name: toolName } as const),
    extra: /sonnet-5-5/.test(model)
      ? { thinking: { type: 'between_tools' } } // no extended thinking: cheaper and fits max_tokens
      : /opus-5-5|fable|mythos/.test(model)
        ? { output_config: { effort: 'low' } } // thinking can't be turned off on these; keep it short
        : modern
          ? {}
          : { temperature: 0.2 },
  };
}

/** One forced tool call: the fixed system prompt, the tool it must call, and the user turn. */
type ToolCall = {
  system: string;
  toolName: string;
  toolDescription: string;
  inputSchema: { type: 'object'; [key: string]: unknown };
  content: Anthropic.ContentBlockParam[];
  /** For a long answer: more output room, and a longer wait than the client's default. */
  maxTokens?: number;
  timeoutMs?: number;
};

export function createClaudeService(options: {
  /** The ready-made client (see `createAnthropicClient`); `apiKey` builds a plain one, as the tests do. */
  client?: Anthropic;
  apiKey?: string;
  model?: string;
  /** Pause before the single retry; tests set 0. */
  retryDelayMs?: number;
}): ClaudeService {
  const retryDelayMs = options.retryDelayMs ?? RETRY_DELAY_MS;
  const model = options.model ?? DEFAULT_MODEL;
  const client = options.client ?? new Anthropic({ ...CLIENT_SETTINGS, apiKey: options.apiKey });
  const analysisSchema = mealAnalysisJsonSchema();
  const insightSchema = insightJsonSchema();
  const recipeSchema = recipeIdeasJsonSchema();
  const fridgeSchema = fridgeScanJsonSchema();
  const voiceSchema = voiceExtractJsonSchema();

  async function call({
    system,
    toolName,
    toolDescription,
    inputSchema,
    content,
    maxTokens = MAX_TOKENS,
    timeoutMs,
  }: ToolCall): Promise<ClaudeResult> {
    const params = modelParams(model, toolName);
    const request = {
      model,
      max_tokens: maxTokens,
      // The fixed system prompt is the cached prefix (tools render before system).
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools: [{ name: toolName, description: toolDescription, input_schema: inputSchema }],
      tool_choice: params.toolChoice,
      messages: [{ role: 'user', content }],
      ...params.extra,
    } as Anthropic.MessageCreateParamsNonStreaming;

    const started = Date.now();
    let retries = 0;
    for (;;) {
      try {
        const message = timeoutMs
          ? await client.messages.create(request, { timeout: timeoutMs })
          : await client.messages.create(request);
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
        const toolUse = message.content.find((block) => block.type === 'tool_use' && block.name === toolName);
        if (!toolUse || toolUse.type !== 'tool_use' || message.stop_reason === 'max_tokens') {
          // Content-free, so a truncated or tool-less answer is diagnosable from the log.
          throw new HttpError('AI_INVALID_OUTPUT', undefined, {
            stopReason: message.stop_reason,
            outputTokens: telemetry.outputTokens,
            anthropicRequestId: telemetry.anthropicRequestId,
          });
        }
        return { raw: toolUse.input, telemetry };
      } catch (error) {
        if (error instanceof HttpError) throw error;
        if (retries < MAX_RETRIES && isRetryable(error)) {
          retries += 1;
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          continue;
        }
        throw toHttpError(error);
      }
    }
  }

  return {
    model,
    analyze(input) {
      const content: Anthropic.ContentBlockParam[] =
        input.kind === 'text'
          ? [
              {
                type: 'text',
                text: textUserMessage(input.text, input.details, input.portion, input.conditions),
              },
            ]
          : [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: input.jpeg.toString('base64') },
              },
              { type: 'text', text: photoUserMessage(input.details, input.portion, input.conditions) },
            ];
      return call({
        system: SYSTEM_PROMPT,
        toolName: TOOL_NAME,
        toolDescription: 'Report the structured reflux-trigger analysis of the meal. Call exactly once.',
        inputSchema: analysisSchema,
        content,
      });
    },
    insight(input) {
      return call({
        system: INSIGHT_SYSTEM_PROMPT,
        toolName: INSIGHT_TOOL_NAME,
        toolDescription: "Report Bellie's short summary of what the person logged. Call exactly once.",
        inputSchema: insightSchema,
        content: [{ type: 'text', text: insightUserMessage(input) }],
      });
    },
    recipes(input) {
      return call({
        system: RECIPE_SYSTEM_PROMPT,
        toolName: RECIPE_TOOL_NAME,
        toolDescription: 'Report three recipe ideas that go easy on the reflux belly. Call exactly once.',
        inputSchema: recipeSchema,
        content: [{ type: 'text', text: recipeUserMessage(input) }],
        maxTokens: RECIPE_MAX_TOKENS,
        timeoutMs: RECIPE_TIMEOUT_MS,
      });
    },
    fridge(input) {
      return call({
        system: FRIDGE_SYSTEM_PROMPT,
        toolName: FRIDGE_TOOL_NAME,
        toolDescription: 'Report the food ingredients visible in the fridge photos. Call exactly once.',
        inputSchema: fridgeSchema,
        content: [
          ...input.jpegs.map((jpeg): Anthropic.ContentBlockParam => ({
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') },
          })),
          { type: 'text', text: FRIDGE_USER_MESSAGE },
        ],
        timeoutMs: FRIDGE_TIMEOUT_MS,
      });
    },
    voiceLog(input) {
      return call({
        system: VOICE_SYSTEM_PROMPT,
        toolName: VOICE_TOOL_NAME,
        toolDescription: 'Report the foods, symptoms and time in what the person said. Call exactly once.',
        inputSchema: voiceSchema,
        content: [{ type: 'text', text: voiceUserMessage(input.transcript, input.context) }],
      });
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
  // The error's class name only, never its message: a failed federation exchange is then visible in the log.
  const upstreamErrorName = error instanceof Error ? error.constructor.name : null;
  const logContext =
    error instanceof Anthropic.APIError
      ? {
          upstreamStatus: error.status ?? null,
          upstreamRequestId: error.requestID ?? null,
          upstreamErrorName,
        }
      : { upstreamStatus: null, upstreamRequestId: null, upstreamErrorName };
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new HttpError('AI_TIMEOUT', undefined, logContext);
  }
  return new HttpError('AI_UPSTREAM_ERROR', undefined, logContext);
}

/** Used when no API key is configured: analysis reports busy instead of crashing the process. */
export function createUnavailableClaudeService(model = DEFAULT_MODEL): ClaudeService {
  return {
    model,
    async analyze() {
      throw new HttpError('SERVICE_BUSY');
    },
    async insight() {
      throw new HttpError('SERVICE_BUSY');
    },
    async recipes() {
      throw new HttpError('SERVICE_BUSY');
    },
    async fridge() {
      throw new HttpError('SERVICE_BUSY');
    },
    async voiceLog() {
      throw new HttpError('SERVICE_BUSY');
    },
  };
}
