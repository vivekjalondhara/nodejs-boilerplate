import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

process.env.DATABASE_URL ??= 'postgres://unused:unused@localhost:5432/unused';

async function check() {
  const { redis } = await import('../src/common/redis');
  const key = `backend-standalone:check:${randomUUID()}`;
  try {
    await redis.connect();
    assert.equal(await redis.ping(), 'PONG');
    await redis.set(key, 'ok', { PX: 200 });
    assert.equal(await redis.get(key), 'ok');
    await setTimeout(300);
    assert.equal(await redis.get(key), null);
    await redis.set(key, 'cleanup', { EX: 30 });
    assert.equal(await redis.del(key), 1);
    assert.equal(await redis.get(key), null);
    console.log('Redis check passed: ping, set/get, expiration, deletion.');
  } finally {
    if (redis.isOpen) redis.destroy();
  }
}

void check().catch(() => {
  console.error('Redis check failed. Verify Redis is running and REDIS_URL is correct.');
  process.exitCode = 1;
});
