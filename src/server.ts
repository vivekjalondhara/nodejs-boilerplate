import { createApp } from './app';
import { logger } from './common/logger';
import { env } from './config/env';
import { sequelize } from './db/sequelize';
import { redis } from './common/redis';

async function start() {
  await sequelize.authenticate();
  await redis.connect();
  const server = createApp().listen(env.port, () => logger.info('Server listening', { port: env.port }));

  const stop = () => {
    server.close(() => {
      void Promise.all([sequelize.close(), redis.isOpen ? redis.close() : Promise.resolve()])
        .catch(() => {
          logger.error('Shutdown failed');
          process.exitCode = 1;
        });
    });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

void start().catch(async (error: unknown) => {
  logger.error('Startup failed', { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
  if (redis.isOpen) redis.destroy();
  await sequelize.close();
});
