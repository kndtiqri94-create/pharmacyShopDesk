export type JsonObject = Record<string, unknown>;

export interface EntityRecord {
  collection: string;
  id: string;
  data: JsonObject;
  uniqueKey: string | null;
  dateKey: string | null;
  /** Creation order (stable list order). */
  ord: number;
  /** Last change in the shared change sequence (the pull cursor reads this). */
  seq: number;
  deleted: boolean;
  updatedAt: string;
}

export interface MovementRecord {
  id: string;
  seq: number;
  productId: string;
  /** Empty string is the product-level (no batch) bucket. */
  batchId: string;
  type: string;
  qtyDelta: number;
  refId: string | null;
  userId: string | null;
  deviceCode: string;
  createdAt: string;
}

export type NewMovement = Omit<MovementRecord, 'seq'>;

export interface PutEntityInput {
  collection: string;
  id: string;
  data: JsonObject;
  uniqueKey: string | null;
  dateKey: string | null;
}

export interface StockSum {
  productId: string;
  batchId: string;
  quantity: number;
}

export interface ProcessedChange {
  changeId: string;
  deviceCode: string;
  status: string;
  reason: string | null;
}

export interface ListEntitiesFilter {
  dateKey?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Thrown by a store when a (collection, uniqueKey) pair is already held by another record. */
export class UniqueKeyConflictError extends Error {
  constructor(
    readonly collection: string,
    readonly uniqueKey: string
  ) {
    super(`Unique key already in use in ${collection}.`);
    this.name = 'UniqueKeyConflictError';
  }
}

/** Thrown when a sync change id was already recorded (a concurrent resend). */
export class DuplicateChangeError extends Error {
  constructor(readonly changeId: string) {
    super('Change already processed.');
    this.name = 'DuplicateChangeError';
  }
}

/** Everything a request may do to stored data, inside one atomic transaction. */
export interface Tx {
  /** Serialise writers that touch the same logical key (advisory lock on Postgres). */
  lock(key: string): Promise<void>;
  getEntity(collection: string, id: string): Promise<EntityRecord | null>;
  /** Live (not deleted) records in creation order. */
  listEntities(collection: string, filter?: ListEntitiesFilter): Promise<EntityRecord[]>;
  findByUniqueKey(collection: string, uniqueKey: string): Promise<EntityRecord | null>;
  putEntity(input: PutEntityInput): Promise<EntityRecord>;
  /** Marks the record deleted (tombstone) and frees its unique key. False when it did not exist. */
  deleteEntity(collection: string, id: string): Promise<boolean>;
  /** Appends movements; ids already recorded are skipped and reported. Never overwrites. */
  insertMovements(
    movements: readonly NewMovement[]
  ): Promise<{ inserted: MovementRecord[]; duplicateIds: string[] }>;
  listMovements(filter?: { productId?: string; refId?: string }): Promise<MovementRecord[]>;
  sumMovements(productId?: string): Promise<StockSum[]>;
  getProcessedChange(changeId: string): Promise<ProcessedChange | null>;
  /** Throws DuplicateChangeError when the id exists. */
  putProcessedChange(change: ProcessedChange): Promise<void>;
  entitiesSince(cursor: number, limit: number): Promise<EntityRecord[]>;
  movementsSince(cursor: number, limit: number): Promise<MovementRecord[]>;
  currentSeq(): Promise<number>;
}

export interface Store {
  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
  ping(): Promise<void>;
  close(): Promise<void>;
}
