import request from 'supertest';
import { createApp } from '../../src/app';

jest.mock('../../src/config/env', () => ({
  env: {
    nodeEnv: 'test',
    port: 3000,
    databaseUrl: 'postgres://unused:unused@localhost:5432/unused',
    corsOrigin: 'http://localhost:5173',
    rateLimitWindowMs: 60_000,
    rateLimitMax: 100,
    trustProxy: 0,
  },
}));

it('allows the configured browser origin and rejects other origins', async () => {
  const app = createApp();
  const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
  const rejected = await request(app).get('/api/health').set('Origin', 'http://example.com');
  const preflight = await request(app)
    .options('/api/items')
    .set('Origin', 'http://localhost:5173')
    .set('Access-Control-Request-Method', 'POST');

  expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  expect(preflight.status).toBe(204);
  expect(preflight.headers['access-control-allow-origin']).toBe('http://localhost:5173');
});
