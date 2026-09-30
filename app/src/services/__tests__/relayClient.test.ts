import { convertFormDataAsync } from 'expo/src/winter/fetch/convertFormData';

import { friendlyMessages } from '@/lib/errors';

import { getNetworkStateAsync } from 'expo-network';

import { analyzeFood } from '../relayClient';
import { getIdToken } from '../firebase';

// A stand-in with the parts of an expo-file-system File that Expo's multipart encoder uses.
jest.mock('expo-file-system', () => ({
  File: class {
    name = 'meal.jpg';
    type = 'image/jpeg';
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    async bytes() {
      return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    }
  },
}));
jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn() }));
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

// On a phone, FormData is React Native's class patched by Expo (expo/src/winter). Jest's default is
// Node's FormData, which would turn a file object into "[object Object]" and hide the real failure.
const originalFormData = global.FormData;
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const NativeFormData = require('react-native/Libraries/Network/FormData').default;
  // The jest-expo preset stubs this module, so load the real one.
  const { installFormDataPatch } = jest.requireActual('expo/src/winter/FormData');
  installFormDataPatch(NativeFormData);
  global.FormData = NativeFormData;
});
afterAll(() => {
  global.FormData = originalFormData;
});

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
    expect(init.body).toBeInstanceOf(global.FormData);
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('builds a photo form that Expo fetch can encode (a plain { uri } object cannot be)', async () => {
    fetchMock.mockReturnValue(json(200, analysis));
    await analyzeFood({ photo: { uri: 'file:///meal.jpg' } });
    const [, init] = fetchMock.mock.calls[0];

    // The same encoder Expo's global fetch runs on every multipart body. It throws
    // "Unsupported FormDataPart implementation" for React Native's { uri, name, type } object.
    const { body, boundary } = await convertFormDataAsync(init.body);
    const text = Buffer.from(body).toString('latin1');
    expect(text).toContain('name="photo"');
    expect(text).toContain('filename="meal.jpg"');
    expect(text).toContain('content-type: image/jpeg');
    expect(text).toContain(`\r\n--${boundary}--`);
    // The photo bytes are in the body.
    expect(Buffer.from(body).includes(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]))).toBe(true);
  });

  it('shows the old { uri } form is rejected by the encoder', async () => {
    const legacy = new FormData();
    legacy.append('photo', { uri: 'file:///meal.jpg', name: 'photo.jpg', type: 'image/jpeg' } as never);

    await expect(convertFormDataAsync(legacy)).rejects.toThrow(/Unsupported FormDataPart/);
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

  it('reports OFFLINE when the request fails and the phone has no connection', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    (getNetworkStateAsync as jest.Mock).mockResolvedValueOnce({ isConnected: false });

    const error = await analyzeFood({ text: 'a' }).catch((e) => e);

    expect(error.code).toBe('OFFLINE');
    expect(error.friendlyMessage).toBe(friendlyMessages.OFFLINE);
  });

  it('reports OFFLINE when the first-run sign-in fails without a connection', async () => {
    (getIdToken as jest.Mock).mockRejectedValueOnce(new Error('auth/network-request-failed'));
    (getNetworkStateAsync as jest.Mock).mockResolvedValueOnce({
      isConnected: true,
      isInternetReachable: false,
    });

    await expect(analyzeFood({ text: 'a' })).rejects.toMatchObject({ code: 'OFFLINE' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the sign-in error when the phone is online', async () => {
    (getIdToken as jest.Mock).mockRejectedValueOnce(new Error('AUTH_FAILED'));
    (getNetworkStateAsync as jest.Mock).mockResolvedValueOnce({
      isConnected: true,
      isInternetReachable: true,
    });

    await expect(analyzeFood({ text: 'a' })).rejects.toThrow('AUTH_FAILED');
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
