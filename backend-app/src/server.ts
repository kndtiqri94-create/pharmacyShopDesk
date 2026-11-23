import { createPrismaClient } from './store/client.js';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { MemoryStore } from './store/memory-store.js';
import { PrismaStore } from './store/prisma-store.js';
import { Store } from './store/types.js';

function createStore(config: ReturnType<typeof loadConfig>): Store {
  if (config.store === 'memory') return new MemoryStore();
  return new PrismaStore(createPrismaClient(config.databaseUrl!));
}

async function main(): Promise<void> {
  const config = loadConfig();
  const store = createStore(config);
  const app = await buildApp({ config, store });
  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await store.close();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
  await app.listen({ host: config.host, port: config.port });
}

main().catch(error => {
  // Configuration errors never include secret values (see loadConfig).
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
