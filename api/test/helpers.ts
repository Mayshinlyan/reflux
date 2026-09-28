import { Writable } from 'node:stream';

import { createApp } from '../src/app.js';
import { type Env, loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';

/** A logger that writes JSON lines into memory so tests can assert on log output. */
export function memoryLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(...chunk.toString().split('\n').filter(Boolean));
      callback();
    },
  });
  const logger = createLogger({ level: 'debug' }, stream);
  return { logger, lines, parsed: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>) };
}

export function testApp(overrides: Partial<Record<keyof Env, string>> = {}) {
  const env = loadEnv({ NODE_ENV: 'test', ...overrides });
  const logs = memoryLogger();
  return { app: createApp({ env, logger: logs.logger }), logs };
}
