import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAnthropicClient, googleIdentityToken } from '../src/services/anthropicClient.js';

const SETTINGS = { maxRetries: 0, timeout: 5_000 };
const FEDERATION = {
  ANTHROPIC_FEDERATION_RULE_ID: 'fdrl_test',
  ANTHROPIC_ORGANIZATION_ID: '00000000-0000-0000-0000-000000000000',
  ANTHROPIC_SERVICE_ACCOUNT_ID: 'svac_test',
  ANTHROPIC_WORKSPACE_ID: 'wrkspc_test',
};

afterEach(() => vi.unstubAllGlobals());

describe('googleIdentityToken', () => {
  it('asks the metadata server for a full token for the Anthropic audience', async () => {
    const fetchFn = vi.fn(async () => new Response('header.payload.signature'));

    await expect(googleIdentityToken(fetchFn as unknown as typeof fetch)).resolves.toBe(
      'header.payload.signature',
    );

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('metadata.google.internal');
    expect(url).toContain('audience=https%3A%2F%2Fapi.anthropic.com');
    expect(url).toContain('format=full');
    expect(init.headers).toEqual({ 'Metadata-Flavor': 'Google' });
  });

  it('fails with the status only, never the body', async () => {
    const fetchFn = vi.fn(async () => new Response('secret-body', { status: 403 }));

    const failure = googleIdentityToken(fetchFn as unknown as typeof fetch);

    await expect(failure).rejects.toThrow(/403/);
    await expect(failure).rejects.not.toThrow(/secret-body/);
  });
});

describe('createAnthropicClient', () => {
  it('has no client without credentials', () => {
    expect(createAnthropicClient({}, SETTINGS)).toBeNull();
  });

  it('uses the API key when federation is not set up', () => {
    const made = createAnthropicClient({ ANTHROPIC_API_KEY: 'sk-ant-test' }, SETTINGS);

    expect(made?.auth).toBe('api-key');
    expect(made?.client.apiKey).toBe('sk-ant-test');
  });

  it('needs the organization id as well as the rule id to use federation', () => {
    const made = createAnthropicClient({ ANTHROPIC_FEDERATION_RULE_ID: 'fdrl_test' }, SETTINGS);

    expect(made).toBeNull();
  });

  it('prefers federation, and passes no API key to the SDK, which would otherwise prefer the key', () => {
    const made = createAnthropicClient({ ANTHROPIC_API_KEY: 'sk-ant-test', ...FEDERATION }, SETTINGS);

    expect(made?.auth).toBe('federation');
    expect(made?.client.apiKey).toBeNull();
  });

  it('exchanges the Google token for an Anthropic one, then calls the API with it', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fake = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes('metadata.google.internal')) return new Response('google.id.token');
      if (url.endsWith('/v1/oauth/token')) {
        return Response.json({ access_token: 'sk-ant-oat01-test', token_type: 'Bearer', expires_in: 600 });
      }
      return Response.json({
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'm',
        content: [{ type: 'text', text: 'hi' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      });
    });
    vi.stubGlobal('fetch', fake);

    const made = createAnthropicClient(FEDERATION, SETTINGS);
    await made?.client.messages.create({
      model: 'm',
      max_tokens: 5,
      messages: [{ role: 'user', content: 'x' }],
    });

    const exchange = calls.find((call) => call.url.endsWith('/v1/oauth/token'));
    expect(JSON.parse(String(exchange?.init?.body))).toMatchObject({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: 'google.id.token',
      federation_rule_id: 'fdrl_test',
      organization_id: FEDERATION.ANTHROPIC_ORGANIZATION_ID,
      service_account_id: 'svac_test',
      workspace_id: 'wrkspc_test',
    });
    const message = calls.find((call) => call.url.endsWith('/v1/messages'));
    expect(new Headers(message?.init?.headers).get('authorization')).toBe('Bearer sk-ant-oat01-test');
  });
});
