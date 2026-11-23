import { Prisma } from '../generated/prisma/client.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import {
  DuplicateChangeError,
  EntityRecord,
  JsonObject,
  ListEntitiesFilter,
  MovementRecord,
  NewMovement,
  ProcessedChange,
  PutEntityInput,
  Store,
  StockSum,
  Tx,
  UniqueKeyConflictError,
} from './types.js';

type Client = Prisma.TransactionClient;

const UNIQUE_VIOLATION = 'P2002';
const TX_TIMEOUT_MS = 15_000;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION;
}

type EntityRow = Prisma.EntityGetPayload<object>;
type MovementRow = Prisma.StockMovementGetPayload<object>;

const toEntity = (row: EntityRow): EntityRecord => ({
  collection: row.collection,
  id: row.id,
  data: row.data as JsonObject,
  uniqueKey: row.uniqueKey,
  dateKey: row.dateKey,
  ord: Number(row.ord),
  seq: Number(row.seq),
  deleted: row.deleted,
  updatedAt: row.updatedAt.toISOString(),
});

const toMovement = (row: MovementRow): MovementRecord => ({
  id: row.id,
  seq: Number(row.seq),
  productId: row.productId,
  batchId: row.batchId,
  type: row.type,
  qtyDelta: row.qtyDelta,
  refId: row.refId,
  userId: row.userId,
  deviceCode: row.deviceCode,
  createdAt: row.occurredAt,
});

/** PostgreSQL store (Prisma). One shared `change_seq` sequence orders every change for the sync cursor. */
export class PrismaStore implements Store {
  constructor(private readonly prisma: PrismaClient) {}

  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async client => work(new PrismaTx(client)), {
      timeout: TX_TIMEOUT_MS,
    });
  }

  async ping(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

class PrismaTx implements Tx {
  constructor(private readonly client: Client) {}

  private async nextSeq(): Promise<number> {
    const rows = await this.client.$queryRaw<{ value: bigint }[]>`SELECT nextval('change_seq') AS value`;
    return Number(rows[0]?.value ?? 0);
  }

  async lock(key: string): Promise<void> {
    await this.client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }

  async getEntity(collection: string, id: string): Promise<EntityRecord | null> {
    const row = await this.client.entity.findUnique({ where: { collection_id: { collection, id } } });
    return row && !row.deleted ? toEntity(row) : null;
  }

  async listEntities(collection: string, filter: ListEntitiesFilter = {}): Promise<EntityRecord[]> {
    const dateKey =
      filter.dateKey !== undefined
        ? filter.dateKey
        : { gte: filter.dateFrom, lte: filter.dateTo };
    const rows = await this.client.entity.findMany({
      where: {
        collection,
        deleted: false,
        ...(filter.dateKey !== undefined || filter.dateFrom || filter.dateTo ? { dateKey } : {}),
      },
      orderBy: { ord: 'asc' },
    });
    return rows.map(toEntity);
  }

  async findByUniqueKey(collection: string, uniqueKey: string): Promise<EntityRecord | null> {
    const row = await this.client.entity.findFirst({
      where: { collection, uniqueKey, deleted: false },
    });
    return row ? toEntity(row) : null;
  }

  async putEntity(input: PutEntityInput): Promise<EntityRecord> {
    const seq = await this.nextSeq();
    const data = input.data as Prisma.InputJsonValue;
    try {
      const row = await this.client.entity.upsert({
        where: { collection_id: { collection: input.collection, id: input.id } },
        create: {
          collection: input.collection,
          id: input.id,
          uniqueKey: input.uniqueKey,
          dateKey: input.dateKey,
          data,
          ord: seq,
          seq,
        },
        update: {
          uniqueKey: input.uniqueKey,
          dateKey: input.dateKey,
          data,
          seq,
          deleted: false,
        },
      });
      return toEntity(row);
    } catch (error) {
      if (isUniqueViolation(error) && input.uniqueKey !== null) {
        throw new UniqueKeyConflictError(input.collection, input.uniqueKey);
      }
      throw error;
    }
  }

  async deleteEntity(collection: string, id: string): Promise<boolean> {
    const existing = await this.client.entity.findUnique({
      where: { collection_id: { collection, id } },
    });
    if (!existing || existing.deleted) return false;
    await this.client.entity.update({
      where: { collection_id: { collection, id } },
      data: { deleted: true, uniqueKey: null, seq: await this.nextSeq() },
    });
    return true;
  }

  async insertMovements(
    movements: readonly NewMovement[]
  ): Promise<{ inserted: MovementRecord[]; duplicateIds: string[] }> {
    const inserted: MovementRecord[] = [];
    const duplicateIds: string[] = [];
    for (const movement of movements) {
      const seq = await this.nextSeq();
      const rows = await this.client.stockMovement.createManyAndReturn({
        data: [
          {
            id: movement.id,
            seq,
            productId: movement.productId,
            batchId: movement.batchId,
            type: movement.type,
            qtyDelta: movement.qtyDelta,
            refId: movement.refId,
            userId: movement.userId,
            deviceCode: movement.deviceCode,
            occurredAt: movement.createdAt,
          },
        ],
        skipDuplicates: true,
      });
      const row = rows[0];
      if (row) inserted.push(toMovement(row));
      else duplicateIds.push(movement.id);
    }
    return { inserted, duplicateIds };
  }

  async listMovements(
    filter: { productId?: string; refId?: string } = {}
  ): Promise<MovementRecord[]> {
    const rows = await this.client.stockMovement.findMany({
      where: { productId: filter.productId, refId: filter.refId },
      orderBy: { seq: 'asc' },
    });
    return rows.map(toMovement);
  }

  async sumMovements(productId?: string): Promise<StockSum[]> {
    const groups = await this.client.stockMovement.groupBy({
      by: ['productId', 'batchId'],
      where: productId === undefined ? {} : { productId },
      _sum: { qtyDelta: true },
    });
    return groups.map(group => ({
      productId: group.productId,
      batchId: group.batchId,
      quantity: group._sum.qtyDelta ?? 0,
    }));
  }

  async getProcessedChange(changeId: string): Promise<ProcessedChange | null> {
    const row = await this.client.processedChange.findUnique({ where: { changeId } });
    return row
      ? { changeId: row.changeId, deviceCode: row.deviceCode, status: row.status, reason: row.reason }
      : null;
  }

  async putProcessedChange(change: ProcessedChange): Promise<void> {
    try {
      await this.client.processedChange.create({ data: change });
    } catch (error) {
      if (isUniqueViolation(error)) throw new DuplicateChangeError(change.changeId);
      throw error;
    }
  }

  async entitiesSince(cursor: number, limit: number): Promise<EntityRecord[]> {
    const rows = await this.client.entity.findMany({
      where: { seq: { gt: cursor } },
      orderBy: { seq: 'asc' },
      take: limit,
    });
    return rows.map(toEntity);
  }

  async movementsSince(cursor: number, limit: number): Promise<MovementRecord[]> {
    const rows = await this.client.stockMovement.findMany({
      where: { seq: { gt: cursor } },
      orderBy: { seq: 'asc' },
      take: limit,
    });
    return rows.map(toMovement);
  }

  async currentSeq(): Promise<number> {
    const rows = await this.client.$queryRaw<{ value: bigint | null }[]>`
      SELECT GREATEST(
        COALESCE((SELECT MAX(seq) FROM entities), 0),
        COALESCE((SELECT MAX(seq) FROM stock_movements), 0)
      ) AS value`;
    return Number(rows[0]?.value ?? 0);
  }
}
