import { File } from 'expo-file-system';

import { relayBaseUrl } from '@/lib/config';
import { AppError, isRelayErrorCode } from '@/lib/errors';
import type { AnalysisMeta, MealAnalysis } from '@/types/analysis';

import { getIdToken } from './firebase';

export type AnalysisResult = MealAnalysis & { meta: AnalysisMeta };
/** For a photo, `mimeType` is informational only: the relay detects the real type from the bytes. */
export type AnalyzeInput = { text: string } | { photo: { uri: string; mimeType?: string } };

// Longer than the relay's 30 s Claude timeout, so the relay's own AI_TIMEOUT wins when it can.
const REQUEST_TIMEOUT_MS = 45_000;

function requestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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

export async function analyzeFood(input: AnalyzeInput, signal?: AbortSignal): Promise<AnalysisResult> {
  const id = requestId();
  const token = await getIdToken();

  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'X-Request-Id': id };
  let body: string | FormData;
  if ('text' in input) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ text: input.text });
  } else {
    // Expo's fetch rebuilds multipart bodies itself and only accepts a Blob-like value with
    // bytes (an expo-file-system File). The old React Native { uri, name, type } object throws
    // "Unsupported FormDataPart implementation" and would surface as a network error.
    const form = new FormData();
    form.append('photo', new File(input.photo.uri) as unknown as Blob);
    body = form;
  }

  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${relayBaseUrl()}/v1/analyze-food`, {
      method: 'POST',
      headers,
      body,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new AppError(timeout.aborted ? 'AI_TIMEOUT' : 'NETWORK', id);
  }

  if (!response.ok) throw await toAppError(response, id);
  try {
    return (await response.json()) as AnalysisResult;
  } catch {
    throw new AppError('AI_INVALID_OUTPUT', id);
  }
}
