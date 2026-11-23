# ShopDesk API (backend-app)

Fastify + Prisma + PostgreSQL server for ShopDesk (workstream F-3.3, working stack C4).
Contract: `docs/api-docs/3.3_BACKEND_API_AND_DATABASE_API_DOC.md`. Plan: `docs/features/3.3_BACKEND_API_AND_DATABASE_PLAN.md`.

## Run locally

```bash
cd backend-app
npm ci
npx prisma generate               # client goes to src/generated/prisma (gitignored)
cp .env.example .env          # set API_AUTH_TOKEN and DATABASE_URL
# create the schema in YOUR OWN local database (migration SQL is committed, see prisma/MIGRATION_POLICY.md)
# Prisma 7 does not read .env itself: export DATABASE_URL in your shell first
npm run prisma:migrate:deploy
npm run dev
```

No database yet? `STORE=memory ALLOW_INSECURE_DEV=true npm run dev` runs on the in-memory store (data is lost on exit; refused in production).

## Checks

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript strict check |
| `npm run lint` | ESLint |
| `npm test` | All suites against the in-memory store |
| `npm run test:pg` | The same suites against a real throwaway PostgreSQL (embedded, port 54329) through Prisma, applying the committed migration |
| `npm run build` | Compile to `dist/` |

## Layout

- `src/config.ts` environment configuration (fails fast, never prints secrets)
- `src/app.ts` Fastify app: security headers, CORS, rate limit, bearer guard, HTTPS gate, error format
- `src/domain/` record schemas (mirror the frontend models) and the collection registry
- `src/services/` records, products and stock ledger, sync push/pull, derived reads, Update Products batch
- `src/store/` `Store` interface, in-memory store, Prisma/PostgreSQL store
- `prisma/` schema and committed migration SQL; `prisma.config.ts` (Prisma 7 CLI datasource URL); `src/store/client.ts` (driver adapter `@prisma/adapter-pg`)
- `test/` suites (the same suites run on both stores)

## Security notes

- `/api/v1` needs `Authorization: Bearer <API_AUTH_TOKEN>`. This single shared token is a stop-gap until F-3.5 (real sign-in and the Full/View/No access matrix on the server). Production refuses to start without a 32+ character token, with `ALLOW_INSECURE_DEV`, or with `STORE=memory`.
- In production the API answers over HTTPS only (trust the reverse proxy's `X-Forwarded-Proto`).
- Secrets come from the environment only.
