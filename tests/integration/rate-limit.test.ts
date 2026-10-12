import request from 'supertest';
import { createApp } from '../../src/app';

jest.mock('../../src/config/env', () => ({
  env: {
    nodeEnv: 'test',
    port: 3000,
    databaseUrl: 'postgres://unused:unused@localhost:5432/unused',
    rateLimitWindowMs: 60_000,
    rateLimitMax: 2,
    trustProxy: 0,
  },
}));
jest.mock('../../src/common/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

it('limits API requests and returns rate limit headers', async () => {
  const app = createApp();
  const first = await request(app).get('/api/health');
  const second = await request(app).get('/api/health');
  const third = await request(app).get('/api/health');

  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(first.headers['x-ratelimit-limit']).toBe('2');
  expect(second.headers['x-ratelimit-remaining']).toBe('0');
  expect(third.status).toBe(429);
  expect(third.headers['retry-after']).toBeDefined();
  expect(third.body.responseType).toBe('error');
  const fileRequest = await request(app).post('/api/files/presigned-url').send({ keyPath: { name: 'report.pdf', type: 'application/pdf' } });
  expect(fileRequest.status).toBe(429);
  expect(fileRequest.headers['retry-after']).toBeDefined();
});
