import { rateLimit } from 'express-rate-limit';
import { generalResponse } from '../common/general-response';
import { env } from '../config/env';

// ponytail: this store is per process; use a shared store if the API runs on multiple instances.
export const apiRateLimit = rateLimit({
  windowMs: env.rateLimitWindowMs,
  limit: env.rateLimitMax,
  standardHeaders: false,
  legacyHeaders: true,
  handler: (_req, res) => generalResponse(res, null, 'Too many requests', 'error', false, 429),
});
