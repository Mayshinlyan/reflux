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
    });
  });

  it('parses the kill switch', () => {
    expect(loadEnv({ ANALYSIS_ENABLED: 'false' }).ANALYSIS_ENABLED).toBe(false);
  });

  it('names invalid variables without echoing their values', () => {
    expect(() => loadEnv({ PORT: 'not-a-port-secret' })).toThrow(/PORT/);
    expect(() => loadEnv({ PORT: 'not-a-port-secret' })).not.toThrow(/secret/);
  });
});
