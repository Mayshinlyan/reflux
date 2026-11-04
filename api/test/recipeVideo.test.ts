import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createUnavailableVideoService, createYoutubeVideoService } from '../src/services/videoService.js';
import { testApp, VALID_TOKEN } from './helpers.js';

const auth = { Authorization: `Bearer ${VALID_TOKEN}` };
const post = (app: Parameters<typeof request>[0]) => request(app).post('/v1/recipe-video').set(auth);

function reply(body: unknown, status = 200): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe('POST /v1/recipe-video', () => {
  it('returns 401 AUTH_FAILED without a token, and never looks anything up', async () => {
    const titles: string[] = [];
    const { app } = testApp({}, { video: { find: async (t) => (titles.push(t), 'abcdefghijk') } });
    const res = await request(app).post('/v1/recipe-video').send({ title: 'Kimchi egg fried rice' });

    expect(res.status).toBe(401);
    expect(titles).toHaveLength(0);
  });

  it('returns the video id for the dish name', async () => {
    const titles: string[] = [];
    const { app } = testApp({}, { video: { find: async (t) => (titles.push(t), 'abcdefghijk') } });
    const res = await post(app).send({ title: '  Kimchi egg fried rice ' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ videoId: 'abcdefghijk' });
    expect(titles).toEqual(['Kimchi egg fried rice']);
  });

  it('returns null when there is no video', async () => {
    const { app } = testApp({}, { video: { find: async () => null } });
    const res = await post(app).send({ title: 'Kimchi egg fried rice' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ videoId: null });
  });

  it('rejects a body with anything but a title', async () => {
    const { app } = testApp();
    expect((await post(app).send({ title: 'Soup', notes: 'my symptoms' })).status).toBe(400);
    expect((await post(app).send({ title: '' })).status).toBe(400);
    expect((await post(app).send({ title: 'x'.repeat(121) })).status).toBe(400);
  });

  it('stops after the per-person daily allowance', async () => {
    const { app } = testApp({ PER_USER_DAILY_VIDEO_LIMIT: '2' });
    expect((await post(app).send({ title: 'Soup' })).status).toBe(200);
    expect((await post(app).send({ title: 'Soup' })).status).toBe(200);
    const third = await post(app).send({ title: 'Soup' });
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('createYoutubeVideoService', () => {
  it('asks for an embeddable, safe video of "<title> recipe" and returns the first id', async () => {
    const urls: string[] = [];
    const fetchImpl = (async (url: URL) => {
      urls.push(String(url));
      return new Response(
        JSON.stringify({ items: [{ id: { videoId: 'AAAAAAAAAAA' } }, { id: { videoId: 'BBBBBBBBBBB' } }] }),
      );
    }) as unknown as typeof fetch;
    const service = createYoutubeVideoService({ apiKey: 'k', fetchImpl });

    expect(await service.find('Kimchi egg fried rice')).toBe('AAAAAAAAAAA');
    const url = new URL(urls[0] as string);
    expect(url.searchParams.get('q')).toBe('Kimchi egg fried rice recipe');
    expect(url.searchParams.get('videoEmbeddable')).toBe('true');
    expect(url.searchParams.get('safeSearch')).toBe('strict');
    expect(url.searchParams.get('type')).toBe('video');
  });

  it('returns null when nothing comes back, and skips an odd id', async () => {
    expect(
      await createYoutubeVideoService({ apiKey: 'k', fetchImpl: reply({ items: [] }) }).find('Soup'),
    ).toBeNull();
    expect(await createYoutubeVideoService({ apiKey: 'k', fetchImpl: reply({}) }).find('Soup')).toBeNull();
    expect(
      await createYoutubeVideoService({
        apiKey: 'k',
        fetchImpl: reply({ items: [{ id: { videoId: 'not an id!' } }, { id: { videoId: 'CCCCCCCCCCC' } }] }),
      }).find('Soup'),
    ).toBe('CCCCCCCCCCC');
  });

  it('returns null on a quota error or a network failure, tells onFailure, and does not keep the failure', async () => {
    const reasons: string[] = [];
    const quota = createYoutubeVideoService({
      apiKey: 'secret-key',
      fetchImpl: reply({ error: { message: 'quota' } }, 403),
      onFailure: (r) => reasons.push(r),
    });
    expect(await quota.find('Soup')).toBeNull();

    let calls = 0;
    const flaky = createYoutubeVideoService({
      apiKey: 'secret-key',
      fetchImpl: (async () => {
        calls += 1;
        if (calls === 1) throw new Error('offline');
        return new Response(JSON.stringify({ items: [{ id: { videoId: 'DDDDDDDDDDD' } }] }));
      }) as unknown as typeof fetch,
      onFailure: (r) => reasons.push(r),
    });
    expect(await flaky.find('Soup')).toBeNull();
    expect(await flaky.find('Soup')).toBe('DDDDDDDDDDD');
    expect(reasons).toEqual(['status 403', 'request failed']);
    expect(reasons.join(' ')).not.toContain('secret-key');
  });

  it('keeps answers for a day, misses included, ignoring case and extra spaces', async () => {
    let calls = 0;
    let clock = 0;
    const service = createYoutubeVideoService({
      apiKey: 'k',
      now: () => clock,
      fetchImpl: (async () => {
        calls += 1;
        return new Response(JSON.stringify({ items: [] }));
      }) as unknown as typeof fetch,
    });
    await service.find('Kimchi  Egg');
    await service.find('kimchi egg');
    expect(calls).toBe(1);
    clock = 25 * 60 * 60 * 1000;
    await service.find('kimchi egg');
    expect(calls).toBe(2);
  });

  it('is always empty without a key', async () => {
    expect(await createUnavailableVideoService().find('Soup')).toBeNull();
  });
});
