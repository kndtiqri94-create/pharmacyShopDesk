import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

/**
 * Opt-in (npm run test:pg): starts a throwaway PostgreSQL in a temp folder, applies the committed
 * migration SQL with `prisma migrate deploy`, and runs the SAME API suites against the Prisma store.
 * It never touches any shared database.
 */
const PORT = 54329;

export default async function setup(): Promise<() => Promise<void>> {
  const dir = mkdtempSync(join(tmpdir(), 'shopdesk-pg-'));
  const server = new EmbeddedPostgres({
    databaseDir: join(dir, 'data'),
    user: 'shopdesk',
    password: 'shopdesk-test',
    port: PORT,
    persistent: false,
  });
  await server.initialise();
  await server.start();
  await server.createDatabase('shopdesk_test');
  const url = `postgresql://shopdesk:shopdesk-test@localhost:${PORT}/shopdesk_test`;
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
    shell: true,
  });
  process.env['PG_DATABASE_URL'] = url;
  return async () => {
    await server.stop();
    rmSync(dir, { recursive: true, force: true });
  };
}
