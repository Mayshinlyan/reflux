import { HttpError } from '../errors.js';

/** Audio in, words out. The relay depends on this, so tests inject a fake and the provider can be swapped. */
export interface SpeechToText {
  /** `hint` is a short list of words the person is likely to say (their foods and symptoms), to help spelling. */
  transcribe(audio: Buffer, mimeType: string, hint: string): Promise<string>;
}

const TIMEOUT_MS = 30_000;

/** Extension by type, because the provider reads the file name to pick a decoder. */
const EXTENSIONS: Record<string, string> = {
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
};

/** Any audio type (parameters like `; codecs=` ignored), or a bare binary part, which a phone's upload may send for an m4a. */
export const isAudioType = (mimeType: string) => {
  const type = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
  return type.startsWith('audio/') || type === 'application/octet-stream';
};

/**
 * Any service that speaks the OpenAI `/audio/transcriptions` shape: hosted Whisper-family models, OpenAI itself,
 * or a Whisper server we run ourselves. Swapping provider is a change of base URL, key and model name.
 */
export function createOpenAiCompatibleSpeech(options: {
  baseUrl: string;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}): SpeechToText {
  const doFetch = options.fetchImpl ?? fetch;
  return {
    async transcribe(audio, mimeType, hint) {
      const form = new FormData();
      const name = `voice.${EXTENSIONS[mimeType.split(';')[0]?.trim().toLowerCase() ?? ''] ?? 'm4a'}`;
      form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), name);
      form.append('model', options.model);
      form.append('response_format', 'json');
      form.append('temperature', '0');
      if (hint) form.append('prompt', hint);
      let response: Response;
      try {
        response = await doFetch(`${options.baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${options.apiKey}` },
          body: form,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        const timedOut = error instanceof Error && error.name === 'TimeoutError';
        throw new HttpError(timedOut ? 'AI_TIMEOUT' : 'AI_UPSTREAM_ERROR');
      }
      // Status only, never the body: it can echo the transcript.
      if (!response.ok) {
        throw new HttpError('AI_UPSTREAM_ERROR', undefined, { upstreamStatus: response.status });
      }
      const body = (await response.json().catch(() => null)) as { text?: unknown } | null;
      if (typeof body?.text !== 'string') throw new HttpError('AI_INVALID_OUTPUT');
      return body.text.trim();
    },
  };
}

/** Used when no speech provider is configured: voice logs report busy instead of crashing. */
export function createUnavailableSpeech(): SpeechToText {
  return {
    async transcribe() {
      throw new HttpError('SERVICE_BUSY');
    },
  };
}
