import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { testApp } from './helpers.js';

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const { app } = testApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('keeps /healthz working for local use', async () => {
    const { app } = testApp();
    const res = await request(app).get('/healthz');

    expect(res.status).toBe(200);
  });

  it('sets security headers and hides the framework', async () => {
    const { app } = testApp();
    const res = await request(app).get('/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('request ID', () => {
  it('echoes a well-formed client X-Request-Id', async () => {
    const { app } = testApp();
    const res = await request(app).get('/health').set('X-Request-Id', 'client-req-12345');

    expect(res.headers['x-request-id']).toBe('client-req-12345');
  });

  it('replaces a malformed X-Request-Id with a generated one', async () => {
    const { app } = testApp();
    const res = await request(app).get('/health').set('X-Request-Id', 'bad id <script>');

    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('puts the request ID on every log line for the request', async () => {
    const { app, logs } = testApp();
    await request(app).get('/health').set('X-Request-Id', 'client-req-12345');

    const requestLines = logs.parsed().filter((line) => line.message === 'request completed');
    expect(requestLines).toHaveLength(1);
    expect(requestLines[0]).toMatchObject({
      requestId: 'client-req-12345',
      method: 'GET',
      path: '/health',
      status: 200,
      severity: 'INFO',
    });
  });
});

describe('error contract', () => {
  it('returns NOT_FOUND with the request ID for unknown routes', async () => {
    const { app } = testApp();
    const res = await request(app).get('/nope').set('X-Request-Id', 'client-req-12345');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String), requestId: 'client-req-12345' },
    });
  });

  it('returns INPUT_REJECTED for malformed JSON without echoing the input', async () => {
    const { app, logs } = testApp();
    const res = await request(app)
      .post('/nope')
      .set('Content-Type', 'application/json')
      .send('{"text": "secret pizza"');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INPUT_REJECTED');
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
    expect(JSON.stringify(res.body)).not.toContain('pizza');
    expect(logs.lines.join('\n')).not.toContain('pizza');
  });

  it('returns UPLOAD_TOO_LARGE for oversized JSON bodies', async () => {
    const { app } = testApp();
    const res = await request(app)
      .post('/nope')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ text: 'a'.repeat(20_000) }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('UPLOAD_TOO_LARGE');
  });
});
