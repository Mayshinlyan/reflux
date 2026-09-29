import { friendlyMessages } from '@/lib/errors';

import { analyzeFood } from '../relayClient';

jest.mock('../firebase', () => ({ getIdToken: jest.fn().mockResolvedValue('test-token') }));

const analysis = {
  isFood: true,
  mealName: 'Mint tea',
  items: [],
  overall: { verdict: 'caution', confidence: 'high', reasoning: 'Mint relaxes the sphincter.' },
  meta: { model: 'm', promptVersion: 'p', rulesetVersion: 'r' },
};

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

const fetchMock = jest.fn();

beforeEach(() => {
  process.env.EXPO_PUBLIC_RELAY_URL = 'https://relay.test/';
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('analyzeFood', () => {
  it('posts text with the bearer token and a request id, and returns the analysis', async () => {
    fetchMock.mockReturnValue(json(200, analysis));

    await expect(analyzeFood({ text: 'mint tea' })).resolves.toEqual(analysis);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://relay.test/v1/analyze-food');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-token');
    expect(init.headers['X-Request-Id']).toEqual(expect.any(String));
    expect(JSON.parse(init.body)).toEqual({ text: 'mint tea' });
  });

  it('sends a photo as multipart without forcing a content type', async () => {
    fetchMock.mockReturnValue(json(200, analysis));

    await analyzeFood({ photo: { uri: 'file:///meal.jpg' } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it.each([
    [401, 'AUTH_FAILED'],
    [429, 'RATE_LIMITED'],
    [503, 'SERVICE_BUSY'],
    [422, 'NOT_FOOD'],
    [502, 'AI_INVALID_OUTPUT'],
  ])('maps relay %i to %s and keeps the relay request id', async (status, code) => {
    fetchMock.mockReturnValue(json(status, { error: { code, message: 'x', requestId: 'relay-req' } }));

    await expect(analyzeFood({ text: 'toast' })).rejects.toMatchObject({ code, requestId: 'relay-req' });
  });

  it('falls back to INTERNAL for unknown codes and non-JSON bodies', async () => {
    fetchMock.mockReturnValueOnce(json(500, { error: { code: 'WAT', requestId: 'r' } }));
    await expect(analyzeFood({ text: 'a' })).rejects.toMatchObject({ code: 'INTERNAL' });

    fetchMock.mockReturnValueOnce(Promise.resolve(new Response('<html>bad gateway</html>', { status: 502 })));
    const error = await analyzeFood({ text: 'a' }).catch((e) => e);
    expect(error.code).toBe('INTERNAL');
    expect(error.friendlyMessage).toBe(friendlyMessages.INTERNAL);
  });

  it('reports NETWORK when the request cannot be made', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(analyzeFood({ text: 'a' })).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('rethrows the caller abort untouched', async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValue(new DOMException('aborted', 'AbortError'));

    await expect(analyzeFood({ text: 'a' }, controller.signal)).rejects.toThrow('aborted');
  });

  it('reports AI_INVALID_OUTPUT when a 200 body is not JSON', async () => {
    fetchMock.mockReturnValue(Promise.resolve(new Response('nope', { status: 200 })));

    await expect(analyzeFood({ text: 'a' })).rejects.toMatchObject({ code: 'AI_INVALID_OUTPUT' });
  });
});
