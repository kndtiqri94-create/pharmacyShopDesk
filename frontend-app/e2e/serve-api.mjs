import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(here, '..', '..', 'backend-app');
const tsx = path.join(backend, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const child = spawn(process.execPath, [tsx, 'src/server.ts'], {
  cwd: backend,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
    STORE: 'memory',
    HOST: '127.0.0.1',
    PORT: '3100',
    LOG_LEVEL: 'warn',
    API_AUTH_TOKEN: 'e2e-throwaway-token',
    CORS_ORIGINS: 'http://127.0.0.1:4300',
  },
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill());
child.on('exit', code => process.exit(code ?? 0));
