import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { COLLECTIONS, CollectionSpec, DOCUMENTS_COLLECTION, DOCUMENT_SCHEMAS } from '../domain/collections.js';
import { AppError, notFound, validationError } from '../errors.js';
import { paginate, parsePaging, parseQuery } from '../lib/http.js';
import {
  deleteRecord,
  idOf,
  parseDocument,
  parseRecord,
  postRecordWithMovements,
  upsertRecord,
  writeDocument,
  WriteResult,
} from '../services/records.js';
import { JsonObject, Store } from '../store/types.js';

const filterSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const idParam = z.object({ id: z.string().trim().min(1).max(64) });

function send(reply: FastifyReply, result: WriteResult, extra: JsonObject = {}): FastifyReply {
  if (result.outcome === 'unchanged') void reply.header('Idempotent-Replay', 'true');
  return reply.code(result.outcome === 'created' ? 201 : 200).send({ ...result.record.data, ...extra });
}

/** CRUD for every collection except products, which has its own stock-aware routes. */
export function registerRecordRoutes(app: FastifyInstance, store: Store): void {
  for (const spec of COLLECTIONS) {
    if (spec.name === 'products') continue;
    registerCollection(app, store, spec);
  }
  registerDocuments(app, store);
}

function registerCollection(app: FastifyInstance, store: Store, spec: CollectionSpec): void {
  const base = `/${spec.route}`;

  app.get(base, async request => {
    const filter = parseQuery(filterSchema, request.query);
    const paging = parsePaging(request.query);
    const rows = await store.transaction(tx =>
      tx.listEntities(spec.name, {
        dateKey: filter.date,
        dateFrom: filter.dateFrom,
        dateTo: filter.dateTo,
      })
    );
    return paginate(
      rows.map(row => row.data),
      paging
    );
  });

  app.get(`${base}/:id`, async request => {
    const { id } = parseQuery(idParam, request.params);
    const row = await store.transaction(tx => tx.getEntity(spec.name, id));
    if (!row) throw notFound('The record');
    return row.data;
  });

  app.post(base, async (request, reply) => {
    const result = await store.transaction(tx =>
      spec.withMovements
        ? postRecordWithMovements(tx, spec, request.body)
        : writeOne(tx, spec, request.body)
    );
    const movements = 'movements' in result ? { movements: result.movements } : {};
    return send(reply, result, movements);
  });

  app.put(`${base}/:id`, async (request, reply) => {
    const { id } = parseQuery(idParam, request.params);
    const result = await store.transaction(async tx => {
      const written = spec.withMovements
        ? await postRecordWithMovements(tx, spec, request.body)
        : await writeOne(tx, spec, request.body);
      if (written.record.id !== id) {
        throw validationError('The id in the path must match the id in the body.');
      }
      return written;
    });
    const movements = 'movements' in result ? { movements: result.movements } : {};
    return send(reply, result, movements);
  });

  app.delete(`${base}/:id`, async (request, reply) => {
    const { id } = parseQuery(idParam, request.params);
    const removed = await store.transaction(tx => deleteRecord(tx, spec, id));
    if (!removed) throw notFound('The record');
    return reply.code(204).send();
  });
}

async function writeOne(
  tx: Parameters<Parameters<Store['transaction']>[0]>[0],
  spec: CollectionSpec,
  body: unknown
): Promise<WriteResult> {
  const data = parseRecord(spec, body);
  if (idOf(spec, data) === '') throw validationError(`The ${spec.idField} is required.`);
  return upsertRecord(tx, spec, data);
}

function registerDocuments(app: FastifyInstance, store: Store): void {
  for (const [documentId, entry] of Object.entries(DOCUMENT_SCHEMAS)) {
    const path = `/settings/${entry.route}`;
    app.get(path, async () => {
      const row = await store.transaction(tx => tx.getEntity(DOCUMENTS_COLLECTION, documentId));
      if (!row) throw new AppError(404, 'not_found', 'These settings have not been saved yet.');
      return row.data;
    });
    app.put(path, async (request, reply) => {
      const data = parseDocument(documentId, request.body);
      const result = await store.transaction(tx => writeDocument(tx, documentId, data));
      return send(reply, result);
    });
  }
}
