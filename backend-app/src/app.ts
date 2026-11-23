import { createHash, timingSafeEqual } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AppConfig } from './config.js';
import { AppError, errorBody } from './errors.js';
import { registerRecordRoutes } from './routes/records.js';
import { registerStockRoutes } from './routes/stock.js';
import { registerReportRoutes, registerSyncRoutes } from './routes/sync-and-reports.js';
import { issuesToDetails } from './services/records.js';
import { Store } from './store/types.js';

export const API_PREFIX = '/api/v1';
const BODY_LIMIT_BYTES = 2 * 1024 * 1024;
const RATE_LIMIT_PER_MINUTE = 600;

export interface AppDeps {
  config: AppConfig;
  store: Store;
  now?: () => string;
}

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/** Constant-time comparison of the presented bearer token with the configured one. */
function tokenMatches(presented: string, expected: string): boolean {
  return timingSafeEqual(digest(presented), digest(expected));
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config, store } = deps;
  const now = deps.now ?? (() => new Date().toISOString());
  const app = Fastify({
    bodyLimit: BODY_LIMIT_BYTES,
    trustProxy: config.requireHttps,
    logger: {
      level: config.logLevel,
      // Credentials and request bodies (customer and pay data) never reach the logs.
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Device-Code'],
  });
  await app.register(rateLimit, { max: RATE_LIMIT_PER_MINUTE, timeWindow: '1 minute' });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send(errorBody('not_found', 'This route does not exist.'))
  );

  app.setErrorHandler((error: FastifyError | AppError | ZodError, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send(errorBody(error.code, error.message, error.details));
    }
    if (error instanceof ZodError) {
      return reply
        .code(400)
        .send(errorBody('validation_error', 'The request is not valid.', issuesToDetails(error)));
    }
    const statusCode = 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
    if (statusCode === 429) {
      return reply.code(429).send(errorBody('rate_limited', 'Too many requests. Try again shortly.'));
    }
    if (statusCode === 413) {
      return reply.code(413).send(errorBody('payload_too_large', 'The request body is too large.'));
    }
    if (statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send(errorBody('bad_request', 'The request could not be read.'));
    }
    // Unexpected failure: log it with the request id, tell the caller nothing internal.
    request.log.error({ err: error, requestId: request.id }, 'unhandled error');
    return reply
      .code(500)
      .send(errorBody('internal_error', 'Something went wrong. Please try again.'));
  });

  // Health endpoints are anonymous and reveal nothing about data or configuration.
  app.get('/health', () => ({ status: 'ok' }));
  app.get('/health/ready', async (_request, reply) => {
    try {
      await store.ping();
      return { status: 'ready' };
    } catch (error) {
      app.log.error({ err: error }, 'readiness check failed');
      return reply.code(503).send({ status: 'unavailable' });
    }
  });

  await app.register(
    async api => {
      api.addHook('onRequest', async (request, reply) => {
        if (config.requireHttps && request.protocol !== 'https') {
          return reply
            .code(403)
            .send(errorBody('https_required', 'This API is available over HTTPS only.'));
        }
        if (config.authToken === null) return; // insecure development mode (never in production)
        const header = request.headers.authorization ?? '';
        const [scheme, token] = header.split(' ');
        if (scheme?.toLowerCase() !== 'bearer' || !token || !tokenMatches(token, config.authToken)) {
          return reply
            .header('WWW-Authenticate', 'Bearer')
            .code(401)
            .send(errorBody('unauthenticated', 'Sign in is required.'));
        }
      });
      registerStockRoutes(api, store, now);
      registerRecordRoutes(api, store);
      registerSyncRoutes(api, store);
      registerReportRoutes(api, store);
    },
    { prefix: API_PREFIX }
  );

  return app;
}
