import { describe, expect, it } from 'vitest';

import { loadEnv } from '../src/config/env.js';

describe('loadEnv', () => {
  it('applies safe defaults', () => {
    const env = loadEnv({});
    expect(env).toMatchObject({
      PORT: 8080,
      ANALYSIS_ENABLED: true,
      PER_USER_DAILY_LIMIT: 30,
      GLOBAL_DAILY_LIMIT: 300,
      PER_USER_DAILY_RECIPE_LIMIT: 15,
    });
  });

  it('parses the kill switch', () => {
    expect(loadEnv({ ANALYSIS_ENABLED: 'false' }).ANALYSIS_ENABLED).toBe(false);
  });

  it('names invalid variables without echoing their values', () => {
    expect(() => loadEnv({ PORT: 'not-a-port-secret' })).toThrow(/PORT/);
    expect(() => loadEnv({ PORT: 'not-a-port-secret' })).not.toThrow(/secret/);
  });
  it('reads the federation ids, and treats empty ones as not set', () => {
    expect(
      loadEnv({
        ANTHROPIC_FEDERATION_RULE_ID: 'fdrl_x',
        ANTHROPIC_ORGANIZATION_ID: 'org',
        ANTHROPIC_SERVICE_ACCOUNT_ID: '',
        ANTHROPIC_WORKSPACE_ID: '',
      }),
    ).toMatchObject({
      ANTHROPIC_FEDERATION_RULE_ID: 'fdrl_x',
      ANTHROPIC_ORGANIZATION_ID: 'org',
      ANTHROPIC_SERVICE_ACCOUNT_ID: undefined,
      ANTHROPIC_WORKSPACE_ID: undefined,
    });
    expect(loadEnv({ ANTHROPIC_FEDERATION_RULE_ID: '', ANTHROPIC_ORGANIZATION_ID: '' })).toMatchObject({
      ANTHROPIC_FEDERATION_RULE_ID: undefined,
    });
  });

  it('asks for the organization id when a federation rule id is set', () => {
    expect(() => loadEnv({ ANTHROPIC_FEDERATION_RULE_ID: 'fdrl_x' })).toThrow(/ANTHROPIC_ORGANIZATION_ID/);
  });

  it('refuses other federation ids without the rule id, instead of silently ignoring them', () => {
    expect(() => loadEnv({ ANTHROPIC_ORGANIZATION_ID: 'org' })).toThrow(/ANTHROPIC_ORGANIZATION_ID/);
    expect(() => loadEnv({ ANTHROPIC_SERVICE_ACCOUNT_ID: 'svac_x' })).toThrow(/ANTHROPIC_SERVICE_ACCOUNT_ID/);
    expect(() => loadEnv({ ANTHROPIC_WORKSPACE_ID: 'wrkspc_x' })).toThrow(/ANTHROPIC_WORKSPACE_ID/);
  });
});
