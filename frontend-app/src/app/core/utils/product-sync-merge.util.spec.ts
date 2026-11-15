import { testBatch, testProduct } from '../../../testing/pos-test.util';
import { ProductSyncServerRecord } from '../models/domain/product-sync.model';
import {
  applyServerRecord,
  buildSyncRecord,
  computeStockDelta,
  createProductFromServer,
  hasUnusableMatchKeys,
  productMatchKey,
} from './product-sync-merge.util';
import { getStockOnHand } from './stock-status.util';

describe('product-sync-merge.util', () => {
  const TODAY = '2026-09-21';
  const serverRecord = (
    overrides: Partial<ProductSyncServerRecord> = {}
  ): ProductSyncServerRecord => ({
    matchKey: '1',
    name: 'Server name',
    category: 'Server category',
    unit: 'box',
    priceCents: 999,
    costCents: 555,
    stockOnHand: 70,
    active: false,
    ...overrides,
  });

  describe('match key', () => {
    it('uses the barcode when present', () => {
      expect(productMatchKey(testProduct({ barcode: ' 123 ', sku: 'S' }))).toBe('123');
    });

    it('falls back to the sku when the barcode is blank', () => {
      expect(productMatchKey(testProduct({ barcode: '   ', sku: ' SKU-1 ' }))).toBe('SKU-1');
    });

    it('flags blank and repeated keys', () => {
      const blank = testProduct({ barcode: '', sku: '' });
      const first = testProduct({ id: 'a', barcode: '1' });
      const second = testProduct({ id: 'b', barcode: '1' });
      expect(hasUnusableMatchKeys([blank])).toBeTrue();
      expect(hasUnusableMatchKeys([first, second])).toBeTrue();
      expect(hasUnusableMatchKeys([first, testProduct({ id: 'c', barcode: '2' })])).toBeFalse();
    });
  });

  describe('stock delta', () => {
    it('is the change since the last synced baseline', () => {
      expect(computeStockDelta(95, 100)).toBe(-5);
      expect(computeStockDelta(110, 100)).toBe(10);
      expect(computeStockDelta(100, 100)).toBe(0);
    });

    it('is zero when there is no baseline yet', () => {
      expect(computeStockDelta(95, undefined)).toBe(0);
    });
  });

  describe('buildSyncRecord', () => {
    it('carries the details, delta and an operation id from the sequence', () => {
      const product = testProduct({ barcode: '777', batches: [testBatch({ quantity: 95 })] });
      const record = buildSyncRecord(product, { lastSyncedStock: 100, opSeq: 3 });
      expect(record.matchKey).toBe('777');
      expect(record.stockOnHand).toBe(95);
      expect(record.stockDelta).toBe(-5);
      expect(record.operationId).toBe('777:3');
    });

    it('starts the sequence at zero with no delta for an unseen product', () => {
      const record = buildSyncRecord(testProduct({ barcode: '777' }), undefined);
      expect(record.stockDelta).toBe(0);
      expect(record.operationId).toBe('777:0');
    });
  });

  describe('applyServerRecord', () => {
    it('lets the server win on every detail and takes the server stock', () => {
      const product = testProduct({ batches: [testBatch({ quantity: 100 })] });
      const merged = applyServerRecord(product, serverRecord(), 100, TODAY);
      expect(merged.name).toBe('Server name');
      expect(merged.category).toBe('Server category');
      expect(merged.unit).toBe('box');
      expect(merged.priceCents).toBe(999);
      expect(merged.costCents).toBe(555);
      expect(merged.active).toBeFalse();
      expect(getStockOnHand(merged)).toBe(70);
    });

    it('keeps a sale made after the batch was sent', () => {
      const product = testProduct({ batches: [testBatch({ quantity: 98 })] });
      const merged = applyServerRecord(product, serverRecord({ stockOnHand: 70 }), 100, TODAY);
      expect(getStockOnHand(merged)).toBe(68);
    });

    it('never goes below zero stock', () => {
      const product = testProduct({ batches: [testBatch({ quantity: 0 })] });
      const merged = applyServerRecord(product, serverRecord({ stockOnHand: 1 }), 50, TODAY);
      expect(getStockOnHand(merged)).toBe(0);
    });

    it('sets plain stock for a product without batches', () => {
      const product = testProduct({ trackBatches: false, batches: [], stockOnHand: 10 });
      const merged = applyServerRecord(product, serverRecord({ stockOnHand: 42 }), 10, TODAY);
      expect(merged.stockOnHand).toBe(42);
    });

    it('does not change fields the sync does not own', () => {
      const product = testProduct({ manufacturer: 'Maker', sku: 'KEEP' });
      const merged = applyServerRecord(product, serverRecord(), 100, TODAY);
      expect(merged.manufacturer).toBe('Maker');
      expect(merged.sku).toBe('KEEP');
      expect(merged.id).toBe(product.id);
    });
  });

  describe('createProductFromServer', () => {
    it('builds a new product keyed by the match key with no id yet', () => {
      const created = createProductFromServer(serverRecord({ matchKey: 'NEW-1', stockOnHand: 5 }));
      expect(created.id).toBe('');
      expect(created.barcode).toBe('NEW-1');
      expect(created.sku).toBe('NEW-1');
      expect(created.stockOnHand).toBe(5);
      expect(created.batches).toEqual([]);
      expect(created.name).toBe('Server name');
    });
  });
});
