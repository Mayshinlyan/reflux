import express from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';

import type { Env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestContext } from './middleware/requestContext.js';
import type { FeedbackStore } from './lib/feedbackStore.js';
import { type AnalyzeDeps, analyzeRoutes } from './routes/analyze.routes.js';
import { feedbackRoutes } from './routes/feedback.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { insightRoutes } from './routes/insight.routes.js';

export type AppDeps = { env: Env; logger: Logger; feedbackStore: FeedbackStore } & Omit<AnalyzeDeps, 'env'>;

/** No CORS: the only client is the native app, never a browser. */
export function createApp({ env, logger, verifier, rateLimitStore, claude, feedbackStore }: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true); // Cloud Run terminates TLS in front of us.

  app.use(requestContext(logger));
  app.use(helmet());
  // Text analysis bodies are tiny; photo uploads use multipart with their own limit (Step 5).
  app.use(express.json({ limit: '16kb' }));

  app.use(healthRoutes());
  app.use(analyzeRoutes({ env, verifier, rateLimitStore, claude }));
  app.use(insightRoutes({ env, verifier, rateLimitStore, claude }));
  app.use(feedbackRoutes({ env, verifier, rateLimitStore, feedbackStore }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
