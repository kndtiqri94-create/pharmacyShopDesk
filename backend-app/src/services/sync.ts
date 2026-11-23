import { z } from 'zod';
import {
  COLLECTION_BY_NAME,
  DOCUMENTS_COLLECTION,
  DOCUMENT_SCHEMAS,
  SYNC_ENTITIES,
} from '../domain/collections.js';
import { AppError, validationError } from '../errors.js';
import {
  DuplicateChangeError,
  EntityRecord,
  JsonObject,
  MovementRecord,
  Store,
  Tx,
} from '../store/types.js';
import { ProductData, mergeSyncedProduct } from './products.js';
import {
  idOf,
  issuesToDetails,
  parseDocument,
  parseMovement,
  parseRecord,
  sameJson,
  upsertRecord,
  writeDocument,
} from './records.js';

export const MAX_PUSH_CHANGES = 500;
export const DEFAULT_PULL_LIMIT = 200;
export const MAX_PULL_LIMIT = 500;

export type ChangeStatus = 'accepted' | 'duplicate' | 'rejected';

export interface ChangeResult {
  changeId: string;
  status: ChangeStatus;
  /** Machine-readable reason for duplicate / rejected (and flagged accepts). */
  reason?: string;
  message?: string;
}

const changeSchema = z.object({
  changeId: z.string().min(1).max(100),
  entity: z.string().min(1).max(60),
  op: z.enum(['put', 'delete']),
  id: z.string().min(1).max(64),
  data: z.unknown().optional(),
  /** The server `seq` of this record the device last saw. Null/absent for a record it never synced. */
  baseSeq: z.number().int().min(0).nullable().optional(),
});

export const pushRequestSchema = z.object({
  deviceCode: z.string().regex(/^[A-Z0-9]{2,4}$/, 'Device code is 2 to 4 capital letters or digits.'),
  changes: z.array(z.unknown()).max(MAX_PUSH_CHANGES),
});

type Change = z.infer<typeof changeSchema>;

class Outcome {
  constructor(
    readonly status: ChangeStatus,
    readonly reason?: string,
    readonly message?: string
  ) {}
}
const accepted = (reason?: string, message?: string): Outcome => new Outcome('accepted', reason, message);
const duplicate = (reason: string): Outcome => new Outcome('duplicate', reason);
const rejected = (reason: string, message: string): Outcome => new Outcome('rejected', reason, message);

/**
 * Push: handles every change in order, each in its own transaction. The result of a change is
 * remembered by changeId, so the whole batch can be sent again and nothing changes (FR-OFF-7).
 * Rejections are reserved for malformed or unusable changes; stock never causes one (OQ47 proposal).
 */
export async function pushChanges(store: Store, body: unknown): Promise<{ results: ChangeResult[] }> {
  const envelope = pushRequestSchema.safeParse(body);
  if (!envelope.success) {
    throw validationError('The sync batch is not valid.', issuesToDetails(envelope.error));
  }
  const { deviceCode, changes } = envelope.data;
  const results: ChangeResult[] = [];
  for (const raw of changes) {
    const parsed = changeSchema.safeParse(raw);
    if (!parsed.success) {
      const changeId =
        typeof (raw as JsonObject | null)?.['changeId'] === 'string'
          ? String((raw as JsonObject)['changeId'])
          : '';
      results.push({
        changeId,
        status: 'rejected',
        reason: 'invalid_change',
        message: 'The change is missing required fields.',
      });
      continue;
    }
    results.push(await pushOne(store, deviceCode, parsed.data));
  }
  return { results };
}

async function pushOne(store: Store, deviceCode: string, change: Change): Promise<ChangeResult> {
  try {
    const outcome = await store.transaction(async tx => {
      const seen = await tx.getProcessedChange(change.changeId);
      if (seen) return duplicate(seen.reason ?? 'already_processed');
      const result = await applyChange(tx, change);
      await tx.putProcessedChange({
        changeId: change.changeId,
        deviceCode,
        status: result.status,
        reason: result.reason ?? null,
      });
      return result;
    });
    return toResult(change.changeId, outcome);
  } catch (error) {
    if (error instanceof DuplicateChangeError) {
      return { changeId: change.changeId, status: 'duplicate', reason: 'already_processed' };
    }
    throw error;
  }
}

const toResult = (changeId: string, outcome: Outcome): ChangeResult => ({
  changeId,
  status: outcome.status,
  ...(outcome.reason !== undefined ? { reason: outcome.reason } : {}),
  ...(outcome.message !== undefined ? { message: outcome.message } : {}),
});

async function applyChange(tx: Tx, change: Change): Promise<Outcome> {
  if (!SYNC_ENTITIES.has(change.entity)) {
    return rejected('unknown_entity', 'This kind of record is not synced.');
  }
  try {
    if (change.entity === 'stockMovements') return await applyMovement(tx, change);
    if (change.entity === DOCUMENTS_COLLECTION) return await applyDocument(tx, change);
    return await applyRecord(tx, change);
  } catch (error) {
    if (error instanceof AppError && error.statusCode < 500) {
      return rejected(error.code, error.message);
    }
    throw error;
  }
}

async function applyMovement(tx: Tx, change: Change): Promise<Outcome> {
  if (change.op === 'delete') {
    return rejected('movement_cannot_be_deleted', 'Stock movements are never deleted.');
  }
  const movement = parseMovement(change.data);
  if (movement.id !== change.id) return rejected('id_mismatch', 'The change id does not match the movement.');
  const { duplicateIds } = await tx.insertMovements([movement]);
  return duplicateIds.length > 0 ? duplicate('movement_already_recorded') : accepted();
}

/** Server wins: a device that did not see the server's latest version never overwrites it. */
function serverIsNewer(existing: EntityRecord, baseSeq: number | null | undefined): boolean {
  return baseSeq === null || baseSeq === undefined || existing.seq > baseSeq;
}

async function applyDocument(tx: Tx, change: Change): Promise<Outcome> {
  if (!DOCUMENT_SCHEMAS[change.id]) return rejected('unknown_document', 'This settings document does not exist.');
  if (change.op === 'delete') return rejected('document_cannot_be_deleted', 'Settings cannot be deleted.');
  const data = parseDocument(change.id, change.data);
  const existing = await tx.getEntity(DOCUMENTS_COLLECTION, change.id);
  if (existing && serverIsNewer(existing, change.baseSeq)) {
    return duplicate(sameJson(existing.data, data) ? 'unchanged' : 'server_wins');
  }
  await writeDocument(tx, change.id, data);
  return accepted();
}

async function applyRecord(tx: Tx, change: Change): Promise<Outcome> {
  const spec = COLLECTION_BY_NAME.get(change.entity)!;
  if (change.op === 'delete') {
    if (spec.immutable) return rejected('immutable_record', 'A posted record cannot be deleted.');
    const existing = await tx.getEntity(spec.name, change.id);
    if (!existing) return duplicate('already_deleted');
    if (serverIsNewer(existing, change.baseSeq)) return duplicate('server_wins');
    await tx.deleteEntity(spec.name, change.id);
    return accepted();
  }
  let data = parseRecord(spec, change.data);
  if (idOf(spec, data) !== change.id) return rejected('id_mismatch', 'The change id does not match the record.');
  const existing = await tx.getEntity(spec.name, change.id);
  if (existing) {
    if (sameJson(existing.data, data)) return duplicate('unchanged');
    if (spec.immutable) return duplicate('server_wins');
    if (serverIsNewer(existing, change.baseSeq)) return duplicate('server_wins');
  }
  if (spec.name === 'products') {
    data = mergeSyncedProduct((existing?.data as ProductData | undefined) ?? null, data as ProductData);
  }
  // A posted sale/return/receipt is never lost to a number clash: it is kept and flagged.
  const result = await upsertRecord(tx, spec, data, { dropClashingUniqueKey: spec.immutable === true });
  if (spec.immutable && spec.uniqueKey && result.record.uniqueKey === null && spec.uniqueKey(data) !== null) {
    return accepted('unique_key_clash_flagged', 'Kept, but its number clashes with another record. Review it.');
  }
  return accepted();
}

// ---------------------------------------------------------------------------------------- pull

export interface PulledChange {
  entity: string;
  id: string;
  op: 'put' | 'delete';
  seq: number;
  data: JsonObject | null;
}

export interface PullResponse {
  changes: PulledChange[];
  /** Pass this back as `cursor` on the next pull. */
  nextCursor: number;
  hasMore: boolean;
}

const fromEntity = (row: EntityRecord): PulledChange => ({
  entity: row.collection,
  id: row.id,
  op: row.deleted ? 'delete' : 'put',
  seq: row.seq,
  data: row.deleted ? null : row.data,
});

const fromMovement = (row: MovementRecord): PulledChange => ({
  entity: 'stockMovements',
  id: row.id,
  op: 'put',
  seq: row.seq,
  data: {
    id: row.id,
    seq: row.seq,
    productId: row.productId,
    batchId: row.batchId,
    type: row.type,
    qtyDelta: row.qtyDelta,
    refId: row.refId,
    userId: row.userId,
    deviceCode: row.deviceCode,
    createdAt: row.createdAt,
  },
});

/** Pull: every change after `cursor`, oldest first. Products carry base quantities; stock arrives as movements. */
export async function pullChanges(tx: Tx, cursor: number, limit: number): Promise<PullResponse> {
  const bounded = Math.min(Math.max(limit, 1), MAX_PULL_LIMIT);
  const [entities, movements] = await Promise.all([
    tx.entitiesSince(cursor, bounded + 1),
    tx.movementsSince(cursor, bounded + 1),
  ]);
  const all = [
    ...entities.map(row => ({ internal: !SYNC_ENTITIES.has(row.collection), change: fromEntity(row) })),
    ...movements.map(row => ({ internal: false, change: fromMovement(row) })),
  ].sort((first, second) => first.change.seq - second.change.seq);
  const window = all.slice(0, bounded);
  // Internal bookkeeping collections (names start with an underscore) are never sent to devices,
  // but the cursor still moves past them so a pull cannot stall.
  const page = window.filter(item => !item.internal).map(item => item.change);
  const hasMore = all.length > bounded;
  const last = window[window.length - 1];
  return { changes: page, nextCursor: last ? last.change.seq : cursor, hasMore };
}
