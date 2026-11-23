import { z } from 'zod';
import { CollectionSpec, DOCUMENTS_COLLECTION, DOCUMENT_SCHEMAS } from '../domain/collections.js';
import { movementSchema, movementsEnvelope } from '../domain/schemas.js';
import { AppError, ErrorDetail, conflict, validationError } from '../errors.js';
import {
  EntityRecord,
  JsonObject,
  MovementRecord,
  NewMovement,
  Tx,
  UniqueKeyConflictError,
} from '../store/types.js';

export type WriteOutcome = 'created' | 'updated' | 'unchanged';

export interface WriteResult {
  record: EntityRecord;
  outcome: WriteOutcome;
}

export interface MovementReport {
  recorded: number;
  duplicates: number;
}

export function issuesToDetails(error: z.ZodError): ErrorDetail[] {
  return error.issues.map(issue => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

/** Validates a record against its schema and business rule. Throws a 400 with field details. */
export function parseRecord(spec: CollectionSpec, input: unknown): JsonObject {
  const parsed = spec.schema.safeParse(input);
  if (!parsed.success) {
    throw validationError(`The ${spec.route} record is not valid.`, issuesToDetails(parsed.error));
  }
  const data = parsed.data as JsonObject;
  const problem = spec.check?.(data) ?? null;
  if (problem !== null) throw validationError(problem, [{ message: problem }]);
  return data;
}

export function idOf(spec: CollectionSpec, data: JsonObject): string {
  const value = data[spec.idField];
  return typeof value === 'string' ? value : '';
}

/** Order-insensitive structural equality for JSON values. */
export function sameJson(first: unknown, second: unknown): boolean {
  return canonical(first) === canonical(second);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([first], [second]) => (first < second ? -1 : 1));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export interface UpsertOptions {
  /** Posted records keep their unique key off when it clashes, so a real sale is never lost (sync). */
  dropClashingUniqueKey?: boolean;
}

/**
 * Inserts or replaces a validated record. Immutable records are recorded once: the same content
 * again is 'unchanged', different content under the same id is a conflict.
 */
export async function upsertRecord(
  tx: Tx,
  spec: CollectionSpec,
  data: JsonObject,
  options: UpsertOptions = {}
): Promise<WriteResult> {
  const id = idOf(spec, data);
  await tx.lock(`${spec.name}:${id}`);
  const existing = await tx.getEntity(spec.name, id);
  if (existing && spec.immutable) {
    if (sameJson(existing.data, data)) return { record: existing, outcome: 'unchanged' };
    throw conflict(
      'immutable_record',
      'This record has already been posted and cannot be changed.'
    );
  }
  if (existing && sameJson(existing.data, data)) return { record: existing, outcome: 'unchanged' };
  let uniqueKey = spec.uniqueKey?.(data) ?? null;
  if (uniqueKey !== null) {
    const holder = await tx.findByUniqueKey(spec.name, uniqueKey);
    if (holder && holder.id !== id) {
      if (options.dropClashingUniqueKey) uniqueKey = null;
      else throw conflict(spec.uniqueCode ?? 'duplicate', spec.uniqueMessage ?? 'Duplicate record.');
    }
  }
  try {
    const record = await tx.putEntity({
      collection: spec.name,
      id,
      data,
      uniqueKey,
      dateKey: spec.dateKey?.(data) ?? null,
    });
    return { record, outcome: existing ? 'updated' : 'created' };
  } catch (error) {
    if (error instanceof UniqueKeyConflictError) {
      throw conflict(spec.uniqueCode ?? 'duplicate', spec.uniqueMessage ?? 'Duplicate record.');
    }
    throw error;
  }
}

export async function deleteRecord(tx: Tx, spec: CollectionSpec, id: string): Promise<boolean> {
  if (spec.immutable) {
    throw conflict('immutable_record', 'A posted record cannot be deleted.');
  }
  await tx.lock(`${spec.name}:${id}`);
  return tx.deleteEntity(spec.name, id);
}

export function parseMovements(input: unknown): NewMovement[] {
  const parsed = movementsEnvelope.safeParse(input);
  if (!parsed.success) {
    throw validationError('The stock movements are not valid.', issuesToDetails(parsed.error));
  }
  return (parsed.data ?? []).map(toNewMovement);
}

export function parseMovement(input: unknown): NewMovement {
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) {
    throw validationError('The stock movement is not valid.', issuesToDetails(parsed.error));
  }
  return toNewMovement(parsed.data);
}

function toNewMovement(movement: z.infer<typeof movementSchema>): NewMovement {
  return {
    id: movement.id,
    productId: movement.productId,
    batchId: movement.batchId,
    type: movement.type,
    qtyDelta: movement.qtyDelta,
    refId: movement.refId,
    userId: movement.userId,
    deviceCode: movement.deviceCode,
    createdAt: movement.createdAt,
  };
}

/** Records movements once per device-generated id; a repeat is reported, never applied twice. */
export async function recordMovements(
  tx: Tx,
  movements: readonly NewMovement[]
): Promise<{ inserted: MovementRecord[]; report: MovementReport }> {
  if (movements.length === 0) return { inserted: [], report: { recorded: 0, duplicates: 0 } };
  const { inserted, duplicateIds } = await tx.insertMovements(movements);
  return { inserted, report: { recorded: inserted.length, duplicates: duplicateIds.length } };
}

/**
 * Posts a record together with its stock movements in ONE transaction (sales, returns, GRNs,
 * product adjustments). Nothing here ever rejects a posting for stock reasons (OQ47 proposal).
 */
export async function postRecordWithMovements(
  tx: Tx,
  spec: CollectionSpec,
  body: unknown
): Promise<WriteResult & { movements: MovementReport }> {
  const { movements: rawMovements, ...rest } = (body ?? {}) as JsonObject;
  if (rawMovements !== undefined && !spec.withMovements) {
    throw validationError(`The ${spec.route} endpoint does not take stock movements.`);
  }
  const data = parseRecord(spec, rest);
  const movements = parseMovements(rawMovements);
  const result = await upsertRecord(tx, spec, data);
  const { report } = await recordMovements(tx, movements);
  return { ...result, movements: report };
}

export function documentSpecFor(id: string) {
  const entry = DOCUMENT_SCHEMAS[id];
  if (!entry) throw new AppError(404, 'not_found', 'This settings document does not exist.');
  return { id, collection: DOCUMENTS_COLLECTION, schema: entry.schema };
}

export function parseDocument(id: string, input: unknown): JsonObject {
  const entry = documentSpecFor(id);
  const parsed = entry.schema.safeParse(input);
  if (!parsed.success) {
    throw validationError('The settings are not valid.', issuesToDetails(parsed.error));
  }
  return parsed.data as JsonObject;
}

export async function writeDocument(tx: Tx, id: string, data: JsonObject): Promise<WriteResult> {
  await tx.lock(`${DOCUMENTS_COLLECTION}:${id}`);
  const existing = await tx.getEntity(DOCUMENTS_COLLECTION, id);
  if (existing && sameJson(existing.data, data)) return { record: existing, outcome: 'unchanged' };
  const record = await tx.putEntity({
    collection: DOCUMENTS_COLLECTION,
    id,
    data,
    uniqueKey: null,
    dateKey: null,
  });
  return { record, outcome: existing ? 'updated' : 'created' };
}
