import { Injectable, inject } from '@angular/core';
import { Table } from 'dexie';
import { Product } from '../../../../models/domain/product.model';
import { StockMovement } from '../../../../models/domain/stock-movement.model';
import { cloneValue } from '../../../../utils/clone.util';
import { mergePulledProduct } from '../../../../utils/sync-product-merge.util';
import { LocalDatabase, ProductRow, suppressOutbox } from '../local-database';
import { skuKeyOf } from '../local-product-keys';
import { LocalStockLedgerService } from '../local-stock-ledger.service';
import { META_KEYS, writeMeta } from '../local-meta';
import { NEVER_REMOVED_ENTITIES, OUTBOX_ENTITIES } from './outbox-entities.const';
import { changeKey } from './outbox.model';
import { PullPage, PulledChange } from './sync-transport.model';

export interface ApplySummary {
  applied: number;
  skipped: number;
}

type OrderedTable = Table<{ _ord: number }, string>;

@Injectable({ providedIn: 'root' })
export class SyncApplyService {
  private readonly ledger = inject(LocalStockLedgerService);

  applyPage(db: LocalDatabase, page: PullPage): Promise<ApplySummary> {
    return db.transaction('rw', db.tables, async () => {
      suppressOutbox();
      const waiting = await this.waitingKeys(db);
      const summary: ApplySummary = { applied: 0, skipped: 0 };
      const movements: StockMovement[] = [];
      const orders = new Map<string, number>();
      for (const change of page.changes) {
        const handled = await this.applyOne(db, change, waiting, movements, orders);
        if (handled) summary.applied += 1;
        else summary.skipped += 1;
      }
      if (movements.length > 0) await this.ledger.importMovements(db, movements);
      await writeMeta(db, META_KEYS.pullCursor, page.nextCursor);
      return summary;
    });
  }

  private async waitingKeys(db: LocalDatabase): Promise<Set<string>> {
    const rows = await db.outbox.where('status').equals('pending').toArray();
    return new Set(rows.map(row => changeKey(row.entity, row.id)));
  }

  private async applyOne(
    db: LocalDatabase,
    change: PulledChange,
    waiting: ReadonlySet<string>,
    movements: StockMovement[],
    orders: Map<string, number>
  ): Promise<boolean> {
    if (!OUTBOX_ENTITIES.includes(change.entity)) return false;
    if (change.entity === 'stockMovements') return this.collectMovement(change, movements);
    const key = changeKey(change.entity, change.id);
    if (waiting.has(key)) {
      await this.adoptOwnSeq(db, key, change.seq);
      return false;
    }
    if (change.op === 'delete') return this.applyDelete(db, change, key);
    if (!(await this.applyPut(db, change, orders))) return false;
    await db.syncSeqs.put({ key, seq: change.seq });
    return true;
  }

  private collectMovement(change: PulledChange, movements: StockMovement[]): boolean {
    if (change.op !== 'put' || change.data === null || typeof change.data !== 'object')
      return false;
    movements.push(cloneValue(change.data) as StockMovement);
    return true;
  }

  private async adoptOwnSeq(db: LocalDatabase, key: string, seq: number): Promise<void> {
    const row = await db.syncSeqs.get(key);
    if (row?.awaiting === true) await db.syncSeqs.put({ key, seq });
  }

  private async applyDelete(
    db: LocalDatabase,
    change: PulledChange,
    key: string
  ): Promise<boolean> {
    if (NEVER_REMOVED_ENTITIES.includes(change.entity)) return false;
    await db.table(change.entity).delete(change.id);
    await db.syncSeqs.put({ key, seq: change.seq });
    return true;
  }

  private async applyPut(
    db: LocalDatabase,
    change: PulledChange,
    orders: Map<string, number>
  ): Promise<boolean> {
    if (change.data === null || typeof change.data !== 'object') return false;
    if (change.entity === 'documents') {
      await db.documents.put({ id: change.id, value: cloneValue(change.data) });
      return true;
    }
    const table = db.table(change.entity) as OrderedTable;
    const keyPath = table.schema.primKey.keyPath as string;
    if ((change.data as Record<string, unknown>)[keyPath] !== change.id) return false;
    const existing = (await table.get(change.id)) as { _ord: number } | undefined;
    const order = existing?._ord ?? (await this.nextOrder(table, orders));
    const record = cloneValue(change.data) as Record<string, unknown>;
    if (change.entity === 'products') {
      const merged = mergePulledProduct(
        existing as unknown as Product | undefined,
        record as unknown as Product
      );
      const row: ProductRow = { ...merged, _ord: order, skuKey: skuKeyOf(merged.sku) };
      await db.products.put(row);
      return true;
    }
    await table.put({ ...record, _ord: order });
    return true;
  }

  private async nextOrder(table: OrderedTable, orders: Map<string, number>): Promise<number> {
    const known = orders.get(table.name) ?? (await table.orderBy('_ord').last())?._ord ?? 0;
    orders.set(table.name, known + 1);
    return known + 1;
  }
}
