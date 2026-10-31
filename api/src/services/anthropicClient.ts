import Anthropic from '@anthropic-ai/sdk';
import { oidcFederationProvider } from '@anthropic-ai/sdk/lib/credentials/oidc-federation';

import type { Env } from '../config/env.js';

const ANTHROPIC_URL = 'https://api.anthropic.com';
const METADATA_IDENTITY_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';
/** The audience the federation rule is registered with. */
const AUDIENCE = ANTHROPIC_URL;
const METADATA_TIMEOUT_MS = 3_000;

export type AnthropicAuth = 'federation' | 'api-key';

type ClientSettings = { maxRetries: number; timeout: number };

/**
 * A Google-signed identity token for this Cloud Run service's service account. `format=full` puts the `email`
 * claim in, which the federation rule matches on. The SDK asks for a new one each time it re-exchanges.
 */
export async function googleIdentityToken(fetchFn: typeof fetch = fetch): Promise<string> {
  const url = `${METADATA_IDENTITY_URL}?audience=${encodeURIComponent(AUDIENCE)}&format=full`;
  const response = await fetchFn(url, {
    headers: { 'Metadata-Flavor': 'Google' },
    signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
  });
  // Status only: the body of a failed call is never worth logging, and a good one is a credential.
  if (!response.ok) throw new Error(`Metadata server returned ${response.status}`);
  return response.text();
}

/**
 * The Claude client the relay uses, or null when no credentials are configured.
 *
 * Workload identity federation wins when its ids are set, with no API key passed to the SDK: the SDK would
 * prefer a key over federation if it saw both. Otherwise the stored API key is used (local development, and the
 * fallback while federation is being switched on).
 */
export function createAnthropicClient(
  env: Pick<
    Env,
    | 'ANTHROPIC_API_KEY'
    | 'ANTHROPIC_FEDERATION_RULE_ID'
    | 'ANTHROPIC_ORGANIZATION_ID'
    | 'ANTHROPIC_SERVICE_ACCOUNT_ID'
    | 'ANTHROPIC_WORKSPACE_ID'
  >,
  settings: ClientSettings,
  fetchFn: typeof fetch = fetch,
): { client: Anthropic; auth: AnthropicAuth } | null {
  if (env.ANTHROPIC_FEDERATION_RULE_ID && env.ANTHROPIC_ORGANIZATION_ID) {
    const client = new Anthropic({
      ...settings,
      credentials: oidcFederationProvider({
        identityTokenProvider: () => googleIdentityToken(fetchFn),
        federationRuleId: env.ANTHROPIC_FEDERATION_RULE_ID,
        organizationId: env.ANTHROPIC_ORGANIZATION_ID,
        serviceAccountId: env.ANTHROPIC_SERVICE_ACCOUNT_ID,
        workspaceId: env.ANTHROPIC_WORKSPACE_ID,
        baseURL: ANTHROPIC_URL,
        fetch: fetchFn,
      }),
    });
    return { client, auth: 'federation' };
  }
  if (env.ANTHROPIC_API_KEY) {
    return { client: new Anthropic({ ...settings, apiKey: env.ANTHROPIC_API_KEY }), auth: 'api-key' };
  }
  return null;
}
