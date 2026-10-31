import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { FirestoreFeedbackStore, type FirestoreAddLike } from '../src/lib/firestoreFeedbackStore.js';
import { GLOBAL_KEY, InMemoryRateLimitStore } from '../src/lib/rateLimitStore.js';
import { testApp, VALID_TOKEN } from './helpers.js';

const auth = { Authorization: `Bearer ${VALID_TOKEN}` };
const post = (app: Parameters<typeof request>[0]) => request(app).post('/v1/feedback').set(auth);

describe('POST /v1/feedback', () => {
  it('returns 401 AUTH_FAILED without a token and saves nothing', async () => {
    const { app, feedback } = testApp();
    const res = await request(app).post('/v1/feedback').send({ message: 'hello' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_FAILED');
    expect(feedback).toHaveLength(0);
  });

  it('saves the message with its version and platform, and answers 204', async () => {
    const { app, feedback } = testApp();
    const res = await post(app).send({ message: 'Love Bellie', appVersion: '1.2.0', platform: 'ios' });

    expect(res.status).toBe(204);
    expect(feedback).toHaveLength(1);
    expect(feedback[0]).toMatchObject({ message: 'Love Bellie', appVersion: '1.2.0', platform: 'ios' });
    expect(feedback[0]?.createdAt).toBeInstanceOf(Date);
  });

  it('trims the message, keeps its line breaks, and does not store who sent it', async () => {
    const { app, feedback } = testApp();
    const res = await post(app).send({ message: '  Line one\r\nLine two\u0007  ' });

    expect(res.status).toBe(204);
    expect(feedback[0]?.message).toBe('Line one\nLine two');
    expect(Object.keys(feedback[0] ?? {}).sort()).toEqual(['createdAt', 'message']);
  });

  it('never writes the message to the log', async () => {
    const { app, logs } = testApp();
    await post(app).send({ message: 'a very private sentence' });

    expect(logs.lines.join('\n')).not.toContain('a very private sentence');
  });

  it.each([
    ['a missing message', {}],
    ['a blank message', { message: '   \n ' }],
    ['an overlong message', { message: 'x'.repeat(2001) }],
    ['an unknown field', { message: 'hi', meals: ['tacos'] }],
    ['a platform outside the set', { message: 'hi', platform: 'web' }],
    ['an overlong version', { message: 'hi', appVersion: '1'.repeat(33) }],
    ['a message that is not text', { message: 42 }],
  ])('rejects %s with 400 INPUT_REJECTED and saves nothing', async (_name, body) => {
    const { app, feedback } = testApp();
    const res = await post(app).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INPUT_REJECTED');
    expect(feedback).toHaveLength(0);
  });

  it('allows a message of exactly 2000 characters', async () => {
    const { app, feedback } = testApp();
    const res = await post(app).send({ message: 'x'.repeat(2000) });

    expect(res.status).toBe(204);
    expect(feedback).toHaveLength(1);
  });

  it('stops after the per-user daily allowance with 429 RATE_LIMITED', async () => {
    const { app, feedback } = testApp({ PER_USER_DAILY_FEEDBACK_LIMIT: '2' });
    expect((await post(app).send({ message: 'one' })).status).toBe(204);
    expect((await post(app).send({ message: 'two' })).status).toBe(204);
    const third = await post(app).send({ message: 'three' });

    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('RATE_LIMITED');
    expect(feedback).toHaveLength(2);
  });

  it('counts a CRLF pair once toward the 2000-character limit', async () => {
    const { app, feedback } = testApp();
    const res = await post(app).send({ message: 'x\r\n'.repeat(666) + 'x'.repeat(2) });

    expect(res.status).toBe(204);
    expect(feedback[0]?.message.length).toBe(666 * 2 + 2);
  });

  it('has its own allowance and never counts toward the global AI breaker', async () => {
    const rateLimitStore = new InMemoryRateLimitStore();
    const { app } = testApp({ PER_USER_DAILY_FEEDBACK_LIMIT: '1' }, { rateLimitStore });
    await post(app).send({ message: 'one' });

    // The AI counter is untouched, so meal checks keep their full allowance.
    expect(await rateLimitStore.increment(GLOBAL_KEY, new Date())).toBe(1);
  });

  it('stops everyone after the daily feedback ceiling with 503 SERVICE_BUSY, even across people', async () => {
    const rateLimitStore = new InMemoryRateLimitStore();
    const { app, feedback } = testApp({ GLOBAL_DAILY_FEEDBACK_LIMIT: '2' }, { rateLimitStore });
    const as = (uid: string) =>
      request(app).post('/v1/feedback').set('Authorization', `Bearer valid-token-for-${uid}`);
    expect((await as('a').send({ message: 'one' })).status).toBe(204);
    expect((await as('b').send({ message: 'two' })).status).toBe(204);
    const third = await as('c').send({ message: 'three' });

    expect(third.status).toBe(503);
    expect(third.body.error.code).toBe('SERVICE_BUSY');
    expect(feedback).toHaveLength(2);
    // Meal checks are unaffected by feedback hitting its ceiling.
    expect(await rateLimitStore.increment(GLOBAL_KEY, new Date())).toBe(1);
  });

  it('answers 500 INTERNAL when the store cannot save, without logging the message', async () => {
    const { app, logs } = testApp(
      {},
      {
        feedbackStore: {
          async add() {
            throw new Error('firestore down');
          },
        },
      },
    );
    const res = await post(app).send({ message: 'keep this private' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL');
    expect(logs.lines.join('\n')).not.toContain('keep this private');
  });
});

describe('FirestoreFeedbackStore', () => {
  it('adds one document to the feedback collection with the text and time', async () => {
    const added: { collection: string; data: Record<string, unknown> }[] = [];
    const db = {
      collection: (name: string) => ({
        add: async (data: Record<string, unknown>) => {
          added.push({ collection: name, data });
        },
      }),
    } as unknown as FirestoreAddLike;
    const now = new Date('2026-10-30T12:00:00Z');

    await new FirestoreFeedbackStore(db).add({ message: 'hi', platform: 'android' }, now);

    expect(added).toEqual([
      { collection: 'feedback', data: { message: 'hi', platform: 'android', createdAt: now } },
    ]);
  });
});
