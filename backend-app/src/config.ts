import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform(value => value === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().optional(),
  API_AUTH_TOKEN: z.string().optional(),
  ALLOW_INSECURE_DEV: bool,
  CORS_ORIGINS: z.string().default(''),
  REQUIRE_HTTPS: bool,
  STORE: z.enum(['postgres', 'memory']).default('postgres'),
});

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: string;
  databaseUrl: string | null;
  authToken: string | null;
  allowInsecureDev: boolean;
  corsOrigins: string[];
  requireHttps: boolean;
  store: 'postgres' | 'memory';
}

export const MIN_TOKEN_LENGTH = 32;

/** Reads and validates configuration from the environment. Errors never echo a secret value. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid configuration: ${problems.join('; ')}`);
  }
  const raw = parsed.data;
  const production = raw.NODE_ENV === 'production';
  const token = raw.API_AUTH_TOKEN?.trim() ? raw.API_AUTH_TOKEN.trim() : null;
  if (production && raw.ALLOW_INSECURE_DEV) {
    throw new Error('Invalid configuration: ALLOW_INSECURE_DEV is not allowed in production.');
  }
  if (production && raw.STORE === 'memory') {
    throw new Error('Invalid configuration: STORE=memory is not allowed in production.');
  }
  if (token === null && !raw.ALLOW_INSECURE_DEV) {
    throw new Error(
      'Invalid configuration: set API_AUTH_TOKEN (or ALLOW_INSECURE_DEV=true for local development).'
    );
  }
  if (token !== null && production && token.length < MIN_TOKEN_LENGTH) {
    throw new Error(
      `Invalid configuration: API_AUTH_TOKEN must be at least ${MIN_TOKEN_LENGTH} characters.`
    );
  }
  if (raw.STORE === 'postgres' && !raw.DATABASE_URL) {
    throw new Error('Invalid configuration: DATABASE_URL is required when STORE=postgres.');
  }
  return {
    nodeEnv: raw.NODE_ENV,
    host: raw.HOST,
    port: raw.PORT,
    logLevel: raw.LOG_LEVEL,
    databaseUrl: raw.DATABASE_URL ?? null,
    authToken: token,
    allowInsecureDev: raw.ALLOW_INSECURE_DEV,
    corsOrigins: raw.CORS_ORIGINS.split(',')
      .map(origin => origin.trim())
      .filter(origin => origin.length > 0),
    requireHttps: production || raw.REQUIRE_HTTPS,
    store: raw.STORE,
  };
}
