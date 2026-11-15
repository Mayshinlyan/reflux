import { getFirestore } from 'firebase-admin/firestore';

import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { FirestoreFeedbackStore } from './lib/firestoreFeedbackStore.js';
import { FirestoreRateLimitStore } from './lib/firestoreRateLimitStore.js';
import { createAnthropicClient } from './services/anthropicClient.js';
import {
  CLIENT_SETTINGS,
  createClaudeService,
  createUnavailableClaudeService,
} from './services/claudeService.js';
import { createOpenAiCompatibleSpeech, createUnavailableSpeech } from './services/speechToText.js';
import { createFirebaseTokenVerifier } from './services/tokenVerifier.js';

const env = loadEnv();
const logger = createLogger({
  level: env.LOG_LEVEL ?? (env.NODE_ENV === 'production' ? 'info' : 'debug'),
  pretty: env.NODE_ENV === 'development',
});

// The verifier initialises the default Firebase app, which Firestore then reuses.
const verifier = createFirebaseTokenVerifier(env.FIREBASE_PROJECT_ID);
const rateLimitStore = new FirestoreRateLimitStore(getFirestore());
const feedbackStore = new FirestoreFeedbackStore(getFirestore());

const anthropic = createAnthropicClient(env, CLIENT_SETTINGS);
if (!anthropic) {
  logger.warn('No Anthropic credentials are set; analysis will report SERVICE_BUSY');
} else {
  // Which one, never the value.
  logger.info({ auth: anthropic.auth }, 'Anthropic credentials configured');
}
const claude = anthropic
  ? createClaudeService({ client: anthropic.client, model: env.ANTHROPIC_MODEL })
  : createUnavailableClaudeService(env.ANTHROPIC_MODEL);

const speech = env.STT_API_KEY
  ? createOpenAiCompatibleSpeech({ baseUrl: env.STT_BASE_URL, apiKey: env.STT_API_KEY, model: env.STT_MODEL })
  : createUnavailableSpeech();
if (!env.STT_API_KEY) logger.warn('No STT_API_KEY is set; spoken logs will report SERVICE_BUSY');

const server = createApp({ env, logger, verifier, rateLimitStore, claude, feedbackStore, speech }).listen(
  env.PORT,
  () => {
    logger.info(
      { port: env.PORT, analysisEnabled: env.ANALYSIS_ENABLED, model: env.ANTHROPIC_MODEL },
      'relay listening',
    );
  },
);

// Cloud Run sends SIGTERM before stopping an instance; finish in-flight requests.
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  server.close(() => process.exit(0));
});
