import { Router } from 'express';

/** Liveness for Cloud Run probes and the deploy smoke test. Touches no dependencies. */
export function healthRoutes() {
  const router = Router();
  router.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });
  return router;
}
