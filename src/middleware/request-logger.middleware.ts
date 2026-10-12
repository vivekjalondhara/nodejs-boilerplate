import type { RequestHandler } from 'express';
import { logger } from '../common/logger';

export const requestLoggerMiddleware: RequestHandler = (req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    logger.info('HTTP request', {
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Date.now() - started,
    });
  });
  next();
};
