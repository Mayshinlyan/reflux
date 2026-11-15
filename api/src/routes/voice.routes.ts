import { type NextFunction, type Request, type Response, Router } from 'express';
import type { Logger } from 'pino';

import { HttpError } from '../errors.js';
import { firebaseAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { uploadAudio } from '../middleware/upload.js';
import { VOICE_PROMPT_VERSION } from '../prompts/voicePrompt.js';
import {
  issueCodes,
  issuePaths,
  sanitizeFoodText,
  type VoiceContext,
  voiceContextSchema,
  type VoiceExtract,
  voiceExtractSchema,
} from '../schemas.js';
import { isAudioType, type SpeechToText } from '../services/speechToText.js';
import type { AnalyzeDeps } from './analyze.routes.js';

/** The same kill switch as meal checks: answers SERVICE_BUSY before any auth, quota or AI work happens. */
function killSwitch(enabled: boolean) {
  return (_req: Request, _res: Response, next: NextFunction) =>
    next(enabled ? undefined : new HttpError('SERVICE_BUSY'));
}

const MAX_ATTEMPTS = 2;
/** Shorter than this and there is nothing to log (a tap, a cough), so Claude is not called. */
const MIN_TRANSCRIPT_CHARS = 2;
const MAX_TRANSCRIPT_CHARS = 2000;
/** A time a minute ahead of the phone's clock is rounding; further ahead is a mishearing of the day. */
const FUTURE_SLACK_MS = 60_000;

/** The person's own words, to nudge the speech model toward spelling their foods and symptoms right. */
const hintFor = (context: VoiceContext) => [...context.foods, ...context.symptoms].join(', ').slice(0, 400);

function parseContext(raw: unknown): VoiceContext {
  try {
    const parsed = voiceContextSchema.safeParse(JSON.parse(String(raw ?? '')));
    if (parsed.success) return parsed.data;
  } catch {
    // Not JSON: rejected below.
  }
  throw new HttpError('INPUT_REJECTED');
}

/**
 * Spoken logs (POST /v1/voice-log): audio is turned into words, then into foods, symptoms and a time. The audio is
 * held in memory for the call only; neither it nor the words are stored or logged.
 */
export function voiceRoutes({
  env,
  verifier,
  rateLimitStore,
  claude,
  speech,
}: AnalyzeDeps & { speech: SpeechToText }) {
  const router = Router();

  async function extractWithRetry(transcript: string, context: VoiceContext, log: Logger) {
    for (let attempt = 1; ; attempt += 1) {
      let failure: HttpError;
      try {
        const { raw, telemetry } = await claude.voiceLog({ transcript, context });
        const parsed = voiceExtractSchema.safeParse(raw);
        log.info(
          {
            ...telemetry,
            attempt,
            kind: 'voice',
            status: parsed.success ? 'ok' : 'invalid_output',
            zodPaths: parsed.success ? undefined : issuePaths(parsed.error),
            zodCodes: parsed.success ? undefined : issueCodes(parsed.error),
          },
          'claude call completed',
        );
        if (parsed.success) return parsed.data;
        failure = new HttpError('AI_INVALID_OUTPUT');
      } catch (error) {
        if (!(error instanceof HttpError && error.code === 'AI_INVALID_OUTPUT')) throw error;
        failure = error;
      }
      if (attempt >= MAX_ATTEMPTS) throw failure;
      log.warn({ attempt, ...failure.logContext }, 'invalid model output, retrying');
    }
  }

  router.post(
    '/v1/voice-log',
    killSwitch(env.ANALYSIS_ENABLED),
    firebaseAuth(verifier),
    rateLimit(
      rateLimitStore,
      { perUser: env.PER_USER_DAILY_VOICE_LIMIT, global: env.GLOBAL_DAILY_LIMIT },
      undefined,
      'voice',
    ),
    uploadAudio,
    async (req, res, next) => {
      try {
        const file = req.file;
        if (!file || file.size === 0 || !isAudioType(file.mimetype)) throw new HttpError('INPUT_REJECTED');
        const context = parseContext((req.body as Record<string, unknown> | undefined)?.context);

        const heard = sanitizeFoodText(
          await speech.transcribe(file.buffer, file.mimetype, hintFor(context)),
        ).slice(0, MAX_TRANSCRIPT_CHARS);
        const nothing: VoiceExtract = { foods: [], symptoms: [], at: null };
        const extract =
          heard.length < MIN_TRANSCRIPT_CHARS
            ? nothing
            : await extractWithRetry(heard, context, res.locals.log);

        const future = extract.at && Date.parse(extract.at) > Date.parse(context.now) + FUTURE_SLACK_MS;
        res.json({
          transcript: heard,
          foods: extract.foods,
          symptoms: extract.symptoms,
          at: future ? null : extract.at,
          meta: { model: claude.model, promptVersion: VOICE_PROMPT_VERSION, sttModel: env.STT_MODEL },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
