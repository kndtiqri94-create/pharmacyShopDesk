import {
  DuplicateChangeError,
  EntityRecord,
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

interface State {
  seq: number;
  entities: Map<string, EntityRecord>;
  movements: Map<string, MovementRecord>;
  processed: Map<string, ProcessedChange>;
}

const entityKey = (collection: string, id: string): string => `${collection}\u0000${id}`;

function cloneState(state: State): State {
  return {
    seq: state.seq,
    entities: new Map([...state.entities].map(([key, row]) => [key, structuredClone(row)])),
    movements: new Map([...state.movements].map(([key, row]) => [key, { ...row }])),
    processed: new Map([...state.processed].map(([key, row]) => [key, { ...row }])),
  };
}

/**
 * In-memory store with the same semantics as the PostgreSQL store: atomic transactions (one writer
 * at a time, rolled back on error), unique keys, tombstones and one shared change sequence.
 * For development and automated tests only.
 */
export class MemoryStore implements Store {
  private state: State = {
    seq: 0,
    entities: new Map(),
    movements: new Map(),
    processed: new Map(),
  };
  private queue: Promise<unknown> = Promise.resolve();

  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const snapshot = cloneState(this.state);
      try {
        return await work(new MemoryTx(this.state));
      } catch (error) {
        this.state = snapshot;
        throw error;
      }
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  ping(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

class MemoryTx implements Tx {
  constructor(private readonly state: State) {}

  private nextSeq(): number {
    this.state.seq += 1;
    return this.state.seq;
  }

  lock(): Promise<void> {
    return Promise.resolve();
  }

  getEntity(collection: string, id: string): Promise<EntityRecord | null> {
    const row = this.state.entities.get(entityKey(collection, id));
    return Promise.resolve(row && !row.deleted ? structuredClone(row) : null);
  }

  listEntities(collection: string, filter: ListEntitiesFilter = {}): Promise<EntityRecord[]> {
    const rows = [...this.state.entities.values()]
      .filter(row => row.collection === collection && !row.deleted)
      .filter(row => filter.dateKey === undefined || row.dateKey === filter.dateKey)
      .filter(row => filter.dateFrom === undefined || (row.dateKey ?? '') >= filter.dateFrom)
      .filter(row => filter.dateTo === undefined || (row.dateKey ?? '') <= filter.dateTo)
      .sort((first, second) => first.ord - second.ord);
    return Promise.resolve(rows.map(row => structuredClone(row)));
  }

  findByUniqueKey(collection: string, uniqueKey: string): Promise<EntityRecord | null> {
    const row = [...this.state.entities.values()].find(
      item => item.collection === collection && !item.deleted && item.uniqueKey === uniqueKey
    );
    return Promise.resolve(row ? structuredClone(row) : null);
  }

  putEntity(input: PutEntityInput): Promise<EntityRecord> {
    if (input.uniqueKey !== null) {
      const holder = [...this.state.entities.values()].find(
        item =>
          item.collection === input.collection &&
          !item.deleted &&
          item.uniqueKey === input.uniqueKey &&
          item.id !== input.id
      );
      if (holder) throw new UniqueKeyConflictError(input.collection, input.uniqueKey);
    }
    const key = entityKey(input.collection, input.id);
    const existing = this.state.entities.get(key);
    const seq = this.nextSeq();
    const row: EntityRecord = {
      collection: input.collection,
      id: input.id,
      data: structuredClone(input.data),
      uniqueKey: input.uniqueKey,
      dateKey: input.dateKey,
      ord: existing && !existing.deleted ? existing.ord : seq,
      seq,
      deleted: false,
      updatedAt: new Date().toISOString(),
    };
    this.state.entities.set(key, row);
    return Promise.resolve(structuredClone(row));
  }

  deleteEntity(collection: string, id: string): Promise<boolean> {
    const key = entityKey(collection, id);
    const existing = this.state.entities.get(key);
    if (!existing || existing.deleted) return Promise.resolve(false);
    this.state.entities.set(key, {
      ...existing,
      deleted: true,
      uniqueKey: null,
      seq: this.nextSeq(),
      updatedAt: new Date().toISOString(),
    });
    return Promise.resolve(true);
  }

  insertMovements(
    movements: readonly NewMovement[]
  ): Promise<{ inserted: MovementRecord[]; duplicateIds: string[] }> {
    const inserted: MovementRecord[] = [];
    const duplicateIds: string[] = [];
    for (const movement of movements) {
      if (this.state.movements.has(movement.id)) {
        duplicateIds.push(movement.id);
        continue;
      }
      const row: MovementRecord = { ...movement, seq: this.nextSeq() };
      this.state.movements.set(row.id, row);
      inserted.push({ ...row });
    }
    return Promise.resolve({ inserted, duplicateIds });
  }

  listMovements(filter: { productId?: string; refId?: string } = {}): Promise<MovementRecord[]> {
    return Promise.resolve(
      [...this.state.movements.values()]
        .filter(row => filter.productId === undefined || row.productId === filter.productId)
        .filter(row => filter.refId === undefined || row.refId === filter.refId)
        .sort((first, second) => first.seq - second.seq)
        .map(row => ({ ...row }))
    );
  }

  sumMovements(productId?: string): Promise<StockSum[]> {
    const sums = new Map<string, StockSum>();
    for (const row of this.state.movements.values()) {
      if (productId !== undefined && row.productId !== productId) continue;
      const key = `${row.productId}\u0000${row.batchId}`;
      const current = sums.get(key) ?? { productId: row.productId, batchId: row.batchId, quantity: 0 };
      current.quantity += row.qtyDelta;
      sums.set(key, current);
    }
    return Promise.resolve([...sums.values()]);
  }

  getProcessedChange(changeId: string): Promise<ProcessedChange | null> {
    const row = this.state.processed.get(changeId);
    return Promise.resolve(row ? { ...row } : null);
  }

  putProcessedChange(change: ProcessedChange): Promise<void> {
    if (this.state.processed.has(change.changeId)) throw new DuplicateChangeError(change.changeId);
    this.state.processed.set(change.changeId, { ...change });
    return Promise.resolve();
  }

  entitiesSince(cursor: number, limit: number): Promise<EntityRecord[]> {
    return Promise.resolve(
      [...this.state.entities.values()]
        .filter(row => row.seq > cursor)
        .sort((first, second) => first.seq - second.seq)
        .slice(0, limit)
        .map(row => structuredClone(row))
    );
  }

  movementsSince(cursor: number, limit: number): Promise<MovementRecord[]> {
    return Promise.resolve(
      [...this.state.movements.values()]
        .filter(row => row.seq > cursor)
        .sort((first, second) => first.seq - second.seq)
        .slice(0, limit)
        .map(row => ({ ...row }))
    );
  }

  currentSeq(): Promise<number> {
    return Promise.resolve(this.state.seq);
  }
}
