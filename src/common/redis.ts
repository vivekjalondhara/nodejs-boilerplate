import { createClient } from 'redis';
import { env } from '../config/env';
import { logger } from './logger';

export const redis = createClient({
  url: env.redisUrl,
  disableOfflineQueue: true,
  socket: {
    connectTimeout: 5000,
    reconnectStrategy: (retries) => retries < 3 ? Math.min(100 * 2 ** retries, 1000) : false,
  },
});

redis.on('error', () => logger.error('Redis connection error'));
