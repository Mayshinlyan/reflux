import Constants from 'expo-constants';
import { File } from 'expo-file-system';
import { getNetworkStateAsync } from 'expo-network';
import { AppState, Platform } from 'react-native';

import type { ConditionKey } from '@/constants/conditions';
import { relayBaseUrl } from '@/lib/config';
import { AppError, isRelayErrorCode } from '@/lib/errors';
import { isInsight } from '@/lib/insight';
import { isRecipeIdeas, pickRecipe } from '@/lib/recipe';
import type { AnalysisMeta, MealAnalysis, Portion } from '@/types/analysis';
import type { Insight, InsightRequest } from '@/types/insight';
import type { Recipe, RecipeRequest } from '@/types/recipe';

import { getIdToken } from './firebase';

export type AnalysisResult = MealAnalysis & { meta: AnalysisMeta };
/** For a photo, `mimeType` is informational only: the relay detects the real type from the bytes. */
export type AnalyzeInput = ({ text: string } | { photo: { uri: string; mimeType?: string } }) & {
  /** Optional context from the user (what the food is, a correction). The relay caps it at 300 characters. */
  details?: string;
  /** Left out for a regular portion. */
  portion?: Portion;
  /** What the user is managing, to tune the verdict. Left out when there is nothing to say. */
  conditions?: readonly ConditionKey[];
};

// Longer than the relay's 30 s Claude timeout, so the relay's own AI_TIMEOUT wins when it can.
const REQUEST_TIMEOUT_MS = 45_000;

function requestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** True only when the phone reports no connection; if the check itself fails, assume online. */
async function isOffline(): Promise<boolean> {
  try {
    const state = await getNetworkStateAsync();
    return state.isConnected === false || state.isInternetReachable === false;
  } catch {
    return false;
  }
}

/**
 * Watches for the app leaving the foreground, e.g. the phone locking. iOS pauses a request then, and
 * on return its timer has run out or its connection is dead even though the relay may have finished.
 */
function watchBackground() {
  let happened = false;
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'background') happened = true;
  });
  return { happened: () => happened, stop: () => subscription.remove() };
}

/** Turns a non-2xx relay response into an AppError via the shared code mapping. */
async function toAppError(response: Response, fallbackRequestId: string): Promise<AppError> {
  try {
    const body = (await response.json()) as { error?: { code?: unknown; requestId?: unknown } };
    const code = body.error?.code;
    const id = typeof body.error?.requestId === 'string' ? body.error.requestId : fallbackRequestId;
    return new AppError(isRelayErrorCode(code) ? code : 'INTERNAL', id);
  } catch {
    // Non-JSON body, e.g. a Cloud Run front-end error page.
    return new AppError('INTERNAL', fallbackRequestId);
  }
}

/** The signed-in token for a call; signing in needs internet too, so offline then is "offline", not "sign-in failed". */
async function tokenFor(id: string): Promise<string> {
  try {
    return await getIdToken();
  } catch (error) {
    if (await isOffline()) throw new AppError('OFFLINE', id);
    throw error;
  }
}

export async function analyzeFood(input: AnalyzeInput, signal?: AbortSignal): Promise<AnalysisResult> {
  const id = requestId();
  const token = await tokenFor(id);

  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'X-Request-Id': id };
  const buildBody = (): string | FormData => {
    if ('text' in input) {
      headers['Content-Type'] = 'application/json';
      return JSON.stringify({
        text: input.text,
        ...(input.details ? { details: input.details } : {}),
        ...(input.portion ? { portion: input.portion } : {}),
        ...(input.conditions?.length ? { conditions: input.conditions } : {}),
      });
    }
    // Expo's fetch rebuilds multipart bodies itself and only accepts a Blob-like value with
    // bytes (an expo-file-system File). The old React Native { uri, name, type } object throws
    // "Unsupported FormDataPart implementation" and would surface as a network error.
    const form = new FormData();
    form.append('photo', new File(input.photo.uri) as unknown as Blob);
    if (input.details) form.append('details', input.details);
    if (input.portion) form.append('portion', input.portion);
    if (input.conditions?.length) form.append('conditions', input.conditions.join(','));
    return form;
  };

  let response: Response;
  for (let attempt = 1; ; attempt += 1) {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const background = watchBackground();
    try {
      response = await fetch(`${relayBaseUrl()}/v1/analyze-food`, {
        method: 'POST',
        headers,
        body: buildBody(),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      break;
    } catch (error) {
      if (signal?.aborted) throw error;
      if (!timeout.aborted && (await isOffline())) throw new AppError('OFFLINE', id);
      // The app was closed mid-request: that is the phone pausing, not a slow relay, so ask again once.
      if (attempt === 1 && background.happened()) continue;
      throw new AppError(timeout.aborted ? 'AI_TIMEOUT' : 'NETWORK', id);
    } finally {
      background.stop();
    }
  }

  if (!response.ok) throw await toAppError(response, id);
  try {
    return (await response.json()) as AnalysisResult;
  } catch {
    throw new AppError('AI_INVALID_OUTPUT', id);
  }
}

// A summary is a small, quick call, so it gives up sooner than a meal check.
const INSIGHT_TIMEOUT_MS = 30_000;

/**
 * Asks the relay for Bellie's summary of a day or week. The request carries only meal names, verdicts, symptom
 * names and tags (see `InsightRequest`). Throws an AppError like `analyzeFood`; callers fall back to local words.
 */
export async function fetchInsight(request: InsightRequest, signal?: AbortSignal): Promise<Insight> {
  const id = requestId();
  const token = await tokenFor(id);
  const timeout = AbortSignal.timeout(INSIGHT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${relayBaseUrl()}/v1/insight`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-Request-Id': id, 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (!timeout.aborted && (await isOffline())) throw new AppError('OFFLINE', id);
    throw new AppError(timeout.aborted ? 'AI_TIMEOUT' : 'NETWORK', id);
  }

  if (!response.ok) throw await toAppError(response, id);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AppError('AI_INVALID_OUTPUT', id);
  }
  if (!isInsight(body)) throw new AppError('AI_INVALID_OUTPUT', id);
  // Only the fields we show, so nothing else the relay adds (like `meta`) gets cached.
  const { tone, bellieLine, summary, tips } = body;
  return { tone, bellieLine, summary, tips };
}

// Three full recipes take longer than a meal check, and the relay waits up to a minute for them, so the phone waits a bit longer.
const RECIPES_TIMEOUT_MS = 75_000;

/**
 * Asks the relay for three recipe ideas (the Kitchen). The request carries the sheet's choices, the condition and
 * food names only (see `RecipeRequest`). Throws an AppError like `analyzeFood`; the Kitchen then offers Try again.
 */
export async function fetchRecipeIdeas(request: RecipeRequest, signal?: AbortSignal): Promise<Recipe[]> {
  const id = requestId();
  const token = await tokenFor(id);
  const timeout = AbortSignal.timeout(RECIPES_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${relayBaseUrl()}/v1/recipe-ideas`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-Request-Id': id, 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (!timeout.aborted && (await isOffline())) throw new AppError('OFFLINE', id);
    throw new AppError(timeout.aborted ? 'AI_TIMEOUT' : 'NETWORK', id);
  }

  if (!response.ok) throw await toAppError(response, id);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AppError('AI_INVALID_OUTPUT', id);
  }
  if (!isRecipeIdeas(body)) throw new AppError('AI_INVALID_OUTPUT', id);
  // Only the fields we show, so nothing else the relay adds (like `meta`) is kept.
  return body.recipes.map(pickRecipe);
}

// Up to three photos go up and the relay waits up to 45 s for the AI, so the phone waits a little longer.
const FRIDGE_TIMEOUT_MS = 60_000;

/**
 * Sends one to three fridge photos (already shrunk to JPEG) and gets back the food names Bellie can see. Only the
 * photos go; the relay strips their metadata and never keeps them. Throws an AppError like `analyzeFood`. An empty
 * list means nothing edible could be made out.
 */
export async function scanFridge(photoUris: readonly string[], signal?: AbortSignal): Promise<string[]> {
  const id = requestId();
  const token = await tokenFor(id);
  const timeout = AbortSignal.timeout(FRIDGE_TIMEOUT_MS);
  let response: Response;
  try {
    const form = new FormData();
    // Same Blob-like File as a meal photo (see analyzeFood), one `photos` part each.
    for (const uri of photoUris) form.append('photos', new File(uri) as unknown as Blob);
    response = await fetch(`${relayBaseUrl()}/v1/fridge-scan`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-Request-Id': id },
      body: form,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (!timeout.aborted && (await isOffline())) throw new AppError('OFFLINE', id);
    throw new AppError(timeout.aborted ? 'AI_TIMEOUT' : 'NETWORK', id);
  }

  if (!response.ok) throw await toAppError(response, id);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AppError('AI_INVALID_OUTPUT', id);
  }
  const items = (body as { items?: unknown } | null)?.items;
  if (!Array.isArray(items) || !items.every((item) => typeof item === 'string')) {
    throw new AppError('AI_INVALID_OUTPUT', id);
  }
  return items as string[];
}

/** A feedback message is tiny, so it gives up sooner than a meal check. */
const FEEDBACK_TIMEOUT_MS = 20_000;

/**
 * Sends one feedback message from the Settings sheet. Only the typed text, the app version and the phone type
 * (iOS or Android) go, never meals, symptoms or anything else. Throws an AppError like `analyzeFood`.
 */
export async function sendFeedback(message: string, signal?: AbortSignal): Promise<void> {
  const id = requestId();
  const token = await tokenFor(id);
  const appVersion = Constants.expoConfig?.version;
  const body = {
    message,
    ...(appVersion ? { appVersion } : {}),
    ...(Platform.OS === 'ios' || Platform.OS === 'android' ? { platform: Platform.OS } : {}),
  };
  const timeout = AbortSignal.timeout(FEEDBACK_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${relayBaseUrl()}/v1/feedback`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-Request-Id': id, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (!timeout.aborted && (await isOffline())) throw new AppError('OFFLINE', id);
    throw new AppError(timeout.aborted ? 'AI_TIMEOUT' : 'NETWORK', id);
  }
  if (!response.ok) throw await toAppError(response, id);
}
