import { Injectable } from '@angular/core';
import { ProductSyncBaseline } from '../../utils/product-sync-merge.util';

@Injectable({ providedIn: 'root' })
export class ProductSyncStateStore {
  private readonly baselines = new Map<string, ProductSyncBaseline>();

  get(matchKey: string): ProductSyncBaseline | undefined {
    const baseline = this.baselines.get(matchKey);
    return baseline === undefined ? undefined : { ...baseline };
  }

  confirm(matchKey: string, serverStock: number): void {
    const previous = this.baselines.get(matchKey);
    this.baselines.set(matchKey, {
      lastSyncedStock: serverStock,
      opSeq: (previous?.opSeq ?? 0) + 1,
    });
  }

  seed(matchKey: string, lastSyncedStock: number): void {
    this.baselines.set(matchKey, {
      lastSyncedStock,
      opSeq: this.baselines.get(matchKey)?.opSeq ?? 0,
    });
  }
}
