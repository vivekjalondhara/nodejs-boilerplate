import request from 'supertest';
import { createApp } from '../../src/app';

it('serves Swagger UI with the OpenAPI contract and its assets', async () => {
  const app = createApp();
  const page = await request(app).get('/api/docs/');
  const script = await request(app).get('/api/docs/swagger-ui-init.js');
  const stylesheet = await request(app).get('/api/docs/swagger-ui.css');

  expect(page.status).toBe(200);
  expect(page.text).toContain('Swagger UI');
  expect(page.headers['content-security-policy']).toContain("'unsafe-inline'");
  expect(script.status).toBe(200);
  expect(script.text).toContain('Standalone Backend API');
  expect(script.text).toContain('/api/items');
  expect(stylesheet.status).toBe(200);
});
