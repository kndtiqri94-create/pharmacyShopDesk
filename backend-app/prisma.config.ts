import { defineConfig } from 'prisma/config';

// Prisma 7: the connection URL lives here (CLI: migrate/validate), not in schema.prisma.
// The runtime client gets its connection through a driver adapter (see src/store/client.ts).
// Prisma 7 no longer loads .env automatically; export DATABASE_URL (or use `node --env-file=.env`).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder' },
});
