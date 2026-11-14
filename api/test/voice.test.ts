import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { voiceUserMessage } from '../src/prompts/voicePrompt.js';
import { createOpenAiCompatibleSpeech } from '../src/services/speechToText.js';
import { fakeClaude, fakeSpeech, goodVoice, testApp, VALID_TOKEN } from './helpers.js';

const auth = { Authorization: `Bearer ${VALID_TOKEN}` };
const context = {
  now: '2026-11-13T21:30:00-08:00',
  tz: 'America/Los_Angeles',
  foods: ['Oatmeal'],
  symptoms: ['Heartburn'],
};
const audio = Buffer.from('fake-m4a-bytes');

type App = Parameters<typeof request>[0];

const send = (app: App, { ctx = JSON.stringify(context), type = 'audio/mp4', headers = auth } = {}) =>
  request(app)
    .post('/v1/voice-log')
    .set(headers)
    .field('context', ctx)
    .attach('audio', audio, { filename: 'voice.m4a', contentType: type });

const claudeSaying = (answer: (n: number) => unknown) => {
  let tries = 0;
  const claude = fakeClaude(undefined, undefined, undefined, undefined, () => answer((tries += 1)));
  return { claude, tries: () => tries };
};

describe('POST /v1/voice-log', () => {
  it('returns 401 without a token and never hears or thinks', async () => {
    const claude = fakeClaude();
    const speech = fakeSpeech();
    const { app } = testApp({}, { claude: claude.service, speech: speech.service });
    const res = await send(app, { headers: {} as typeof auth });

    expect(res.status).toBe(401);
    expect(speech.calls).toHaveLength(0);
    expect(claude.voiceCalls).toHaveLength(0);
  });

  it('turns audio into the words, foods, symptoms and time', async () => {
    const claude = fakeClaude();
    const speech = fakeSpeech();
    const { app } = testApp({}, { claude: claude.service, speech: speech.service });
    const res = await send(app);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      transcript: 'I had pasta and a glass of wine around eight and my chest is burning',
      ...goodVoice,
      meta: { promptVersion: 'voice-v1' },
    });
    expect(speech.calls[0]).toMatchObject({ mimeType: 'audio/mp4', hint: 'Oatmeal, Heartburn' });
    expect(claude.voiceCalls[0]?.context.tz).toBe('America/Los_Angeles');
  });

  it('skips the AI when nothing was said', async () => {
    const claude = fakeClaude();
    const { app } = testApp({}, { claude: claude.service, speech: fakeSpeech(' ').service });
    const res = await send(app);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ transcript: '', foods: [], symptoms: [], at: null });
    expect(claude.voiceCalls).toHaveLength(0);
  });

  it('treats a time in the future as now', async () => {
    const { claude } = claudeSaying(() => ({ ...goodVoice, at: '2026-11-14T20:00:00-08:00' }));
    const { app } = testApp({}, { claude: claude.service });
    const res = await send(app);

    expect(res.body.at).toBeNull();
  });

  it('rejects a missing file, a wrong type and a bad context', async () => {
    const { app } = testApp();
    const noFile = await request(app)
      .post('/v1/voice-log')
      .set(auth)
      .field('context', JSON.stringify(context));
    expect(noFile.status).toBe(400);
    expect((await send(app, { type: 'image/png' })).status).toBe(400);
    expect((await send(app, { ctx: '{"now":"x"}' })).status).toBe(400);
    expect((await send(app, { ctx: 'not json' })).status).toBe(400);
    expect((await send(app, { ctx: JSON.stringify({ ...context, name: 'Sam' }) })).status).toBe(400);
  });

  it('retries once on an off-schema answer, then gives up', async () => {
    const flaky = claudeSaying((n) => (n === 1 ? { foods: 'pasta' } : goodVoice));
    const { app } = testApp({}, { claude: flaky.claude.service });
    expect((await send(app)).status).toBe(200);
    expect(flaky.tries()).toBe(2);

    const broken = claudeSaying(() => ({ nope: true }));
    const failing = testApp({}, { claude: broken.claude.service });
    const res = await send(failing.app);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('AI_INVALID_OUTPUT');
  });

  it('answers SERVICE_BUSY when the kill switch is off, and RATE_LIMITED past the daily cap', async () => {
    const off = testApp({ ANALYSIS_ENABLED: 'false' });
    expect((await send(off.app)).status).toBe(503);

    const limited = testApp({ PER_USER_DAILY_VOICE_LIMIT: '1' });
    expect((await send(limited.app)).status).toBe(200);
    expect((await send(limited.app)).status).toBe(429);
  });

  it('keeps the words out of the log', async () => {
    const { app, logs } = testApp();
    await send(app);

    expect(logs.lines.join('\n')).not.toContain('pasta');
  });
});

describe('voice prompt and speech provider', () => {
  it('puts the clock, the known words and the transcript in delimited data', () => {
    const message = voiceUserMessage('I had toast', context);
    expect(message).toContain('Now: 2026-11-13T21:30:00-08:00');
    expect(message).toContain('<transcript>\nI had toast\n</transcript>');
  });

  it('posts to /audio/transcriptions and reads `text`', async () => {
    let seen: { url: string; auth: string | null } | undefined;
    const speech = createOpenAiCompatibleSpeech({
      baseUrl: 'https://stt.example/v1/',
      apiKey: 'k',
      model: 'whisper-large-v3',
      fetchImpl: (async (url: string, init: RequestInit) => {
        seen = { url, auth: new Headers(init.headers).get('authorization') };
        return new Response(JSON.stringify({ text: ' hello there ' }));
      }) as unknown as typeof fetch,
    });

    expect(await speech.transcribe(audio, 'audio/mp4', 'Oatmeal')).toBe('hello there');
    expect(seen).toEqual({ url: 'https://stt.example/v1/audio/transcriptions', auth: 'Bearer k' });
  });

  it('maps a provider failure to AI_UPSTREAM_ERROR', async () => {
    const speech = createOpenAiCompatibleSpeech({
      baseUrl: 'https://stt.example/v1',
      apiKey: 'k',
      model: 'm',
      fetchImpl: (async () => new Response('no', { status: 500 })) as unknown as typeof fetch,
    });
    await expect(speech.transcribe(audio, 'audio/mp4', '')).rejects.toMatchObject({
      code: 'AI_UPSTREAM_ERROR',
    });
  });
});
