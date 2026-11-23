import { Injectable, inject } from '@angular/core';
import { StockChangeContext, StockMovement } from '../../../models/domain/stock-movement.model';
import { currentDeviceCode } from '../../../utils/device-identity.util';
import { newId } from '../../../utils/device-id.util';
import { StockSums, mergeMovements, sumMovements } from '../../../utils/stock-ledger.util';
import { ClockService } from '../../clock.service';
import { LocalDatabase } from './local-database';
import { META_KEYS, readMeta, writeMeta } from './local-meta';

export interface StockChange {
  productId: string;
  batchId: string;
  qtyDelta: number;
}

const UNKNOWN_DEVICE = 'UNKNOWN';

@Injectable({ providedIn: 'root' })
export class LocalStockLedgerService {
  private readonly clockService = inject(ClockService);

  async append(
    db: LocalDatabase,
    changes: readonly StockChange[],
    context: StockChangeContext
  ): Promise<StockMovement[]> {
    const movements: StockMovement[] = [];
    let seq = (await readMeta<number>(db, META_KEYS.movementSeq)) ?? 0;
    for (const change of changes) {
      if (change.qtyDelta === 0) continue;
      seq += 1;
      movements.push({
        id: newId(),
        seq,
        productId: change.productId,
        batchId: change.batchId,
        type: context.type,
        qtyDelta: change.qtyDelta,
        refId: context.refId ?? null,
        userId: context.userId ?? null,
        deviceCode: currentDeviceCode() ?? UNKNOWN_DEVICE,
        createdAt: this.clockService.now(),
      });
    }
    if (movements.length === 0) return movements;
    await db.stockMovements.bulkAdd(movements);
    await writeMeta(db, META_KEYS.movementSeq, seq);
    for (const movement of movements)
      await db.enqueue('stockMovements', movement.id, 'put', movement);
    return movements;
  }

  async list(db: LocalDatabase): Promise<StockMovement[]> {
    return db.stockMovements.orderBy('seq').toArray();
  }

  async listForProduct(db: LocalDatabase, productId: string): Promise<StockMovement[]> {
    const movements = await db.stockMovements.where('productId').equals(productId).toArray();
    return movements.sort((first, second) => first.seq - second.seq);
  }

  async sums(db: LocalDatabase): Promise<StockSums> {
    return sumMovements(await db.stockMovements.toArray());
  }

  async sumsForProduct(db: LocalDatabase, productId: string): Promise<StockSums> {
    return sumMovements(await this.listForProduct(db, productId));
  }

  async importMovements(
    db: LocalDatabase,
    incoming: readonly StockMovement[]
  ): Promise<StockMovement[]> {
    return db.transaction('rw', db.outbox, db.stockMovements, db.meta, async () => {
      const current = await this.list(db);
      const merged = mergeMovements(current, incoming);
      const added = merged.slice(current.length);
      let seq = (await readMeta<number>(db, META_KEYS.movementSeq)) ?? 0;
      const stored = added.map(movement => ({ ...movement, seq: (seq += 1) }));
      await db.stockMovements.bulkAdd(stored);
      await writeMeta(db, META_KEYS.movementSeq, seq);
      return stored;
    });
  }
}
