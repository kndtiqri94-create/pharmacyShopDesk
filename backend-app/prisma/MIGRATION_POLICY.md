# Migration policy

- Migration SQL is committed to `prisma/migrations/`. Do NOT apply it from a developer machine to a shared database.
- Production applies it with `npm run prisma:migrate:deploy` during release (DevOps flow, F-3.6).
- The baseline migration also creates the `change_seq` sequence that orders every change (entities and stock movements) for the sync cursor.
- To change the schema: edit `schema.prisma`, run `prisma migrate dev --create-only` against a throwaway local database, review the SQL, commit it.
