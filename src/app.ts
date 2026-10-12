import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { env } from './config/env';
import { errorMiddleware } from './middleware/error.middleware';
import { notFoundMiddleware } from './middleware/not-found.middleware';
import { apiRateLimit } from './middleware/rate-limit.middleware';
import { requestLoggerMiddleware } from './middleware/request-logger.middleware';
import { healthRouter } from './modules/health/health.routes';
import { itemsRouter } from './modules/items/routes';
import { filesRouter } from './modules/files/routes';

const swaggerDocument = YAML.parse(readFileSync(join(__dirname, '../openapi/openapi.yaml'), 'utf8'));

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxy);

  app.use(helmet());
  if (env.corsOrigin) {
    app.use(cors({ origin: (origin, callback) => callback(null, origin === env.corsOrigin) }));
  }
  app.use(requestLoggerMiddleware);
  app.use(apiRateLimit);
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/items', itemsRouter);
  app.use('/api/files', filesRouter);
  app.use(
    '/api/docs',
    helmet.contentSecurityPolicy({
      directives: {
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
      },
    }),
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument),
  );

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);
  return app;
}
