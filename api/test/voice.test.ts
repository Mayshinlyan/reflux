import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { VOICE_SYSTEM_PROMPT, voiceUserMessage } from '../src/prompts/voicePrompt.js';
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
      meals: goodVoice.meals,
      symptoms: goodVoice.symptoms,
      // The older single list and time, for app builds from before meals.
      foods: ['Pasta', 'Glass of wine'],
      at: '2026-11-13T20:00:00-08:00',
      meta: { promptVersion: 'voice-v2' },
    });
    expect(speech.calls[0]).toMatchObject({ mimeType: 'audio/mp4', hint: 'Oatmeal, Heartburn' });
    expect(claude.voiceCalls[0]?.context.tz).toBe('America/Los_Angeles');
  });

  it('skips the AI when nothing was said', async () => {
    const claude = fakeClaude();
    const { app } = testApp({}, { claude: claude.service, speech: fakeSpeech(' ').service });
    const res = await send(app);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ transcript: '', meals: [], foods: [], symptoms: [], at: null });
    expect(claude.voiceCalls).toHaveLength(0);
  });

  it('treats a time in the future as now', async () => {
    const future = '2026-11-14T20:00:00-08:00';
    const { claude } = claudeSaying(() => ({
      ...goodVoice,
      meals: [{ ...goodVoice.meals[0]!, at: future }],
    }));
    const { app } = testApp({}, { claude: claude.service });
    const res = await send(app);

    expect(res.body.meals[0].at).toBeNull();
    expect(res.body.at).toBeNull();
  });

  describe('meals at their own times', () => {
    const lunchDinnerSnack = {
      meals: [
        { label: 'lunch', foods: ['Chicken salad', 'Iced tea'], at: '2026-11-13T12:30:00-08:00' },
        { label: 'snack', foods: ['Granola bar'], at: '2026-11-13T15:45:00-08:00' },
        { label: 'dinner', foods: ['Pasta', 'Iced tea'], at: '2026-11-13T19:00:00-08:00' },
      ],
      symptoms: [],
      at: null,
    };

    it('keeps each meal with its label, foods and time, in the order said', async () => {
      const { claude } = claudeSaying(() => lunchDinnerSnack);
      const { app } = testApp({}, { claude: claude.service });
      const res = await send(app);

      expect(res.status).toBe(200);
      expect(res.body.meals).toEqual(lunchDinnerSnack.meals);
    });

    it('still gives older apps one list of foods (each once) and the latest time', async () => {
      const { claude } = claudeSaying(() => lunchDinnerSnack);
      const { app } = testApp({}, { claude: claude.service });
      const res = await send(app);

      expect(res.body.foods).toEqual(['Chicken salad', 'Iced tea', 'Granola bar', 'Pasta']);
      expect(res.body.at).toBe('2026-11-13T19:00:00-08:00');
    });

    it('drops only the meal whose time is in the future, not the others', async () => {
      const mixed = {
        ...lunchDinnerSnack,
        meals: [
          lunchDinnerSnack.meals[0]!,
          { ...lunchDinnerSnack.meals[2]!, at: '2026-11-14T19:00:00-08:00' },
        ],
      };
      const { claude } = claudeSaying(() => mixed);
      const { app } = testApp({}, { claude: claude.service });
      const res = await send(app);

      expect(res.body.meals.map((meal: { at: string | null }) => meal.at)).toEqual([
        '2026-11-13T12:30:00-08:00',
        null,
      ]);
    });

    it('lets a meal have no label, and no time, when the person gave neither', async () => {
      const unnamed = { meals: [{ label: null, foods: ['Toast'], at: null }], symptoms: [], at: null };
      const { claude } = claudeSaying(() => unnamed);
      const { app } = testApp({}, { claude: claude.service });
      const res = await send(app);

      expect(res.body.meals).toEqual(unnamed.meals);
      expect(res.body.at).toBeNull();
    });

    it('uses the symptoms time when no meal was said', async () => {
      const symptomsOnly = { meals: [], symptoms: ['heartburn'], at: '2026-11-13T08:00:00-08:00' };
      const { claude } = claudeSaying(() => symptomsOnly);
      const { app } = testApp({}, { claude: claude.service });
      const res = await send(app);

      expect(res.body).toMatchObject({ meals: [], foods: [], symptoms: ['heartburn'], at: symptomsOnly.at });
    });

    it('rejects an off-schema meal (an unknown label, or a meal with no foods)', async () => {
      for (const bad of [
        { label: 'brunch', foods: ['Eggs'], at: null },
        { label: 'lunch', foods: [], at: null },
      ]) {
        const { claude } = claudeSaying(() => ({ meals: [bad], symptoms: [], at: null }));
        const { app } = testApp({}, { claude: claude.service });
        const res = await send(app);

        expect(res.status).toBe(502);
        expect(res.body.error.code).toBe('AI_INVALID_OUTPUT');
      }
    });
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

  it('accepts an audio type with parameters, or a bare binary part from a phone upload', async () => {
    const { app } = testApp();

    expect((await send(app, { type: 'audio/mp4; codecs=mp4a.40.2' })).status).toBe(200);
    expect((await send(app, { type: 'application/octet-stream' })).status).toBe(200);
    expect((await send(app, { type: 'text/plain' })).status).toBe(400);
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
  it('tells the model to sort foods into meals, each with its own time, and gives the usual meal times', () => {
    expect(VOICE_SYSTEM_PROMPT).toContain('one entry per meal');
    expect(VOICE_SYSTEM_PROMPT).toContain('breakfast 8:00, lunch 12:30, dinner 19:00');
    expect(VOICE_SYSTEM_PROMPT).toContain('"between lunch and dinner" is halfway between');
    expect(VOICE_SYSTEM_PROMPT).toContain('"around 3 pm" is 15:00');
  });

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
