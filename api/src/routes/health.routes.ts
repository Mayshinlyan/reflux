import { type RequestHandler, Router } from 'express';

/**
 * Liveness for Cloud Run probes and the deploy smoke test. Touches no dependencies.
 * Use `/health` on run.app: Google's front end intercepts `/healthz` there. `/healthz` stays for local use.
 */
export function healthRoutes() {
  const router = Router();
  const ok: RequestHandler = (_req, res) => {
    res.json({ status: 'ok' });
  };
  router.get('/health', ok);
  router.get('/healthz', ok);
  return router;
}
