import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { MemoryStore } from '../src/store/memory-store.js';
import { buildApp } from '../src/app.js';
import { TOKEN, createApi, testConfig, TestApi } from './helpers.js';

describe('S-3.3.1 configuration', () => {
  const base = { API_AUTH_TOKEN: TOKEN, DATABASE_URL: 'postgresql://u:p@localhost/db' };

  it('reads defaults and values from the environment', () => {
    const config = loadConfig({ ...base, PORT: '8080', CORS_ORIGINS: 'https://a.example, https://b.example' });
    expect(config.port).toBe(8080);
    expect(config.corsOrigins).toEqual(['https://a.example', 'https://b.example']);
    expect(config.requireHttps).toBe(false);
  });

  it('requires a token unless insecure development is explicitly allowed', () => {
    expect(() => loadConfig({ DATABASE_URL: base.DATABASE_URL })).toThrow(/API_AUTH_TOKEN/);
    expect(() => loadConfig({ ALLOW_INSECURE_DEV: 'true', STORE: 'memory' })).not.toThrow();
  });

  it('forces HTTPS in production and refuses insecure or weak settings there', () => {
    expect(loadConfig({ ...base, NODE_ENV: 'production' }).requireHttps).toBe(true);
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', ALLOW_INSECURE_DEV: 'true' })).toThrow();
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', STORE: 'memory' })).toThrow();
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', API_AUTH_TOKEN: 'short' })).toThrow(/32/);
  });

  it('needs a database url for postgres and never prints the token in errors', () => {
    expect(() => loadConfig({ API_AUTH_TOKEN: TOKEN })).toThrow(/DATABASE_URL/);
    try {
      loadConfig({ API_AUTH_TOKEN: TOKEN, NODE_ENV: 'production', PORT: 'abc' });
    } catch (error) {
      expect(String(error)).not.toContain(TOKEN);
    }
  });
});

describe('S-3.3.1 API foundation', () => {
  let api: TestApi;
  afterEach(async () => api?.app.close());

  it('serves anonymous health and readiness checks', async () => {
    api = await createApi();
    expect((await api.app.inject({ url: '/health' })).json()).toEqual({ status: 'ok' });
    expect((await api.app.inject({ url: '/health/ready' })).json()).toEqual({ status: 'ready' });
  });

  it('reports not ready when the store is down, without detail', async () => {
    const store = new MemoryStore();
    store.ping = () => Promise.reject(new Error('db password is hunter2'));
    const down = await buildApp({ config: testConfig(), store });
    const response = await down.inject({ url: '/health/ready' });
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain('hunter2');
    await down.close();
  });

  it('refuses requests without a valid bearer token', async () => {
    api = await createApi();
    const anonymous = await api.app.inject({ url: '/api/v1/suppliers' });
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.json().error.code).toBe('unauthenticated');
    const wrong = await api.app.inject({
      url: '/api/v1/suppliers',
      headers: { authorization: 'Bearer nope' },
    });
    expect(wrong.statusCode).toBe(401);
    expect((await api.get('/suppliers')).status).toBe(200);
  });

  it('answers errors in one consistent format', async () => {
    api = await createApi();
    const missing = await api.get('/suppliers/nope');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({
      error: { code: 'not_found', message: 'The record was not found.', details: [] },
    });
    const unknownRoute = await api.app.inject({ url: '/nowhere' });
    expect(unknownRoute.statusCode).toBe(404);
    expect(unknownRoute.json().error.code).toBe('not_found');
    const invalid = await api.post('/suppliers', { id: 's1' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('validation_error');
    expect(invalid.body.error.details.length).toBeGreaterThan(0);
  });

  it('rejects malformed JSON and oversized bodies in the same format', async () => {
    api = await createApi();
    const malformed = await api.app.inject({
      method: 'POST',
      url: '/api/v1/suppliers',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      payload: '{ not json',
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json().error.code).toBe('bad_request');
    const huge = await api.app.inject({
      method: 'POST',
      url: '/api/v1/suppliers',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ blob: 'x'.repeat(3 * 1024 * 1024) }),
    });
    expect(huge.statusCode).toBe(413);
    expect(huge.json().error.code).toBe('payload_too_large');
  });

  it('never leaks internals on an unexpected failure', async () => {
    api = await createApi();
    api.store.transaction = () => Promise.reject(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    const response = await api.get('/suppliers');
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain('10.0.0.5');
    expect(response.body.error.code).toBe('internal_error');
  });

  it('serves the API over HTTPS only when required', async () => {
    api = await createApi({ requireHttps: true });
    const plain = await api.app.inject({
      url: '/api/v1/suppliers',
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(plain.statusCode).toBe(403);
    expect(plain.json().error.code).toBe('https_required');
    const proxied = await api.app.inject({
      url: '/api/v1/suppliers',
      headers: { authorization: `Bearer ${TOKEN}`, 'x-forwarded-proto': 'https' },
    });
    expect(proxied.statusCode).toBe(200);
  });

  it('sends security headers and only allows listed CORS origins', async () => {
    api = await createApi({ corsOrigins: ['https://shop.example'] });
    const allowed = await api.app.inject({
      url: '/health',
      headers: { origin: 'https://shop.example' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe('https://shop.example');
    expect(allowed.headers['x-content-type-options']).toBe('nosniff');
    const other = await api.app.inject({ url: '/health', headers: { origin: 'https://evil.example' } });
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});
