import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseQuery } from '../lib/http.js';
import { cashBook, customerDues } from '../services/derived.js';
import { DEFAULT_PULL_LIMIT, MAX_PULL_LIMIT, pullChanges, pushChanges } from '../services/sync.js';
import { Store } from '../store/types.js';

const pullQuery = z.object({
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(MAX_PULL_LIMIT).default(DEFAULT_PULL_LIMIT),
});

const cashBookQuery = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export function registerSyncRoutes(app: FastifyInstance, store: Store): void {
  /** Push a batch of pending changes. Safe to resend: every change reports accepted, duplicate or rejected. */
  app.post('/sync/push', async request => pushChanges(store, request.body));

  /** Pull changes after a cursor (the `nextCursor` of the previous pull; 0 for the first). */
  app.get('/sync/pull', async request => {
    const query = parseQuery(pullQuery, request.query);
    return store.transaction(tx => pullChanges(tx, query.cursor, query.limit));
  });
}

export function registerReportRoutes(app: FastifyInstance, store: Store): void {
  app.get('/customers/dues', async () => ({
    items: await store.transaction(tx => customerDues(tx)),
  }));

  app.get('/cash-book', async request => {
    const { date } = parseQuery(cashBookQuery, request.query);
    return store.transaction(tx => cashBook(tx, date));
  });
}
