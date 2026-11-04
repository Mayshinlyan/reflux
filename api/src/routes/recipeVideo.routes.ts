import { Router } from 'express';

import { HttpError } from '../errors.js';
import { firebaseAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { recipeVideoBodySchema } from '../schemas.js';
import type { VideoService } from '../services/videoService.js';
import type { AnalyzeDeps } from './analyze.routes.js';

/**
 * A video of the dish for the recipe page (POST /v1/recipe-video). The body is the dish name only. The answer is a
 * YouTube video id, or null when there is none, in which case the app shows nothing. Its own daily allowance, so it
 * never uses up meal checks or recipe rounds.
 */
export function recipeVideoRoutes({
  env,
  verifier,
  rateLimitStore,
  video,
}: Pick<AnalyzeDeps, 'env' | 'verifier' | 'rateLimitStore'> & { video: VideoService }) {
  const router = Router();

  router.post(
    '/v1/recipe-video',
    firebaseAuth(verifier),
    rateLimit(
      rateLimitStore,
      {
        perUser: env.PER_USER_DAILY_VIDEO_LIMIT,
        global: env.GLOBAL_DAILY_VIDEO_LIMIT,
        globalKey: 'video_global',
      },
      undefined,
      'video',
    ),
    async (req, res, next) => {
      try {
        const body = recipeVideoBodySchema.safeParse(req.body);
        if (!body.success) throw new HttpError('INPUT_REJECTED');
        res.json({ videoId: await video.find(body.data.title) });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
