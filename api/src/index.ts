import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createLogger } from './lib/logger.js';

const env = loadEnv();
const logger = createLogger({
  level: env.LOG_LEVEL ?? (env.NODE_ENV === 'production' ? 'info' : 'debug'),
  pretty: env.NODE_ENV === 'development',
});

const server = createApp({ env, logger }).listen(env.PORT, () => {
  logger.info({ port: env.PORT, analysisEnabled: env.ANALYSIS_ENABLED }, 'relay listening');
});

// Cloud Run sends SIGTERM before stopping an instance; finish in-flight requests.
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  server.close(() => process.exit(0));
});
