import { ProductSyncStateStore } from './product-sync-state.store';

describe('ProductSyncStateStore', () => {
  it('has nothing for an unseen product', () => {
    expect(new ProductSyncStateStore().get('A')).toBeUndefined();
  });

  it('records the confirmed stock and advances the sequence', () => {
    const store = new ProductSyncStateStore();
    store.confirm('A', 90);
    store.confirm('A', 80);
    expect(store.get('A')).toEqual({ lastSyncedStock: 80, opSeq: 2 });
  });

  it('seeds a baseline without advancing the sequence', () => {
    const store = new ProductSyncStateStore();
    store.seed('A', 50);
    expect(store.get('A')).toEqual({ lastSyncedStock: 50, opSeq: 0 });
  });

  it('hands out copies so callers cannot change the baseline', () => {
    const store = new ProductSyncStateStore();
    store.confirm('A', 10);
    const copy = store.get('A')!;
    copy.lastSyncedStock = 999;
    expect(store.get('A')!.lastSyncedStock).toBe(10);
  });
});
