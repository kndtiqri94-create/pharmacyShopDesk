import { Product } from '../models/domain/product.model';
import { PRODUCT_SEED } from '../services/data/in-memory/seed/product.seed';
import { allocateStock, getSellableStock } from './pos-stock-allocation.util';

const TODAY = '2026-09-21';

function product(overrides: Partial<Product>): Product {
  return { ...structuredClone(PRODUCT_SEED[0]), ...overrides };
}

const TWO_BATCHES = product({
  costCents: 100,
  batches: [
    { id: 'late', batchNo: 'L', expiryDate: '2028-01-31', quantity: 10, costCents: 120 },
    { id: 'soon', batchNo: 'S', expiryDate: '2027-03-31', quantity: 5, costCents: 110 },
  ],
});

describe('pos stock allocation', () => {
  describe('sellable stock', () => {
    it('adds every batch, and leaves out expired batches when expired sales are blocked', () => {
      const withExpired = product({
        batches: [
          { id: 'old', batchNo: 'O', expiryDate: '2026-08-31', quantity: 7, costCents: 1 },
          { id: 'ok', batchNo: 'K', expiryDate: '2027-08-31', quantity: 3, costCents: 1 },
        ],
      });
      expect(getSellableStock(withExpired, TODAY, true)).toEqual({
        totalQuantity: 10,
        sellableQuantity: 3,
      });
      expect(getSellableStock(withExpired, TODAY, false).sellableQuantity).toBe(10);
    });

    it('treats a batch that expires today as still sellable', () => {
      const todayBatch = product({
        batches: [{ id: 'b', batchNo: 'B', expiryDate: TODAY, quantity: 4, costCents: 1 }],
      });
      expect(getSellableStock(todayBatch, TODAY, true).sellableQuantity).toBe(4);
    });

    it('reads stock on hand for products that do not track batches', () => {
      const plain = product({ trackBatches: false, batches: [], stockOnHand: 8 });
      expect(getSellableStock(plain, TODAY, true)).toEqual({
        totalQuantity: 8,
        sellableQuantity: 8,
      });
    });

    it('is zero for a product with no stock', () => {
      const empty = product({ batches: [], stockOnHand: 0 });
      expect(getSellableStock(empty, TODAY, true)).toEqual({
        totalQuantity: 0,
        sellableQuantity: 0,
      });
    });
  });

  describe('allocation', () => {
    it('takes from the earliest-expiring batch first', () => {
      const result = allocateStock(TWO_BATCHES, 3, TODAY, true);
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.allocations).toEqual([
        { batchId: 'soon', batchNo: 'S', quantity: 3, costCents: 110 },
      ]);
      expect(result.product.batches.find(batch => batch.id === 'soon')?.quantity).toBe(2);
      expect(result.product.batches.find(batch => batch.id === 'late')?.quantity).toBe(10);
    });

    it('moves on to the next batch when one is used up', () => {
      const result = allocateStock(TWO_BATCHES, 8, TODAY, true);
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.allocations.map(item => [item.batchId, item.quantity])).toEqual([
        ['soon', 5],
        ['late', 3],
      ]);
      expect(result.product.batches.find(batch => batch.id === 'soon')?.quantity).toBe(0);
    });

    it('handles exact exhaustion of all stock', () => {
      const result = allocateStock(TWO_BATCHES, 15, TODAY, true);
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.product.batches.every(batch => batch.quantity === 0)).toBeTrue();
    });

    it('refuses more than is available and names how much there is', () => {
      expect(allocateStock(TWO_BATCHES, 16, TODAY, true)).toEqual({
        ok: false,
        availableQuantity: 15,
      });
    });

    it('skips expired batches when they are blocked, and uses them when they are not', () => {
      const withExpired = product({
        batches: [
          { id: 'old', batchNo: 'O', expiryDate: '2026-08-31', quantity: 7, costCents: 1 },
          { id: 'ok', batchNo: 'K', expiryDate: '2027-08-31', quantity: 3, costCents: 2 },
        ],
      });
      const blocked = allocateStock(withExpired, 4, TODAY, true);
      expect(blocked).toEqual({ ok: false, availableQuantity: 3 });
      const allowed = allocateStock(withExpired, 4, TODAY, false);
      expect(allowed.ok && allowed.allocations[0].batchId).toBe('old');
    });

    it('refuses zero, negative and fractional quantities', () => {
      for (const quantity of [0, -1, 1.5, Number.NaN]) {
        expect(allocateStock(TWO_BATCHES, quantity, TODAY, true).ok).toBeFalse();
      }
    });

    it('takes from stock on hand for products without batches', () => {
      const plain = product({ trackBatches: false, batches: [], stockOnHand: 8, costCents: 90 });
      const result = allocateStock(plain, 5, TODAY, true);
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.product.stockOnHand).toBe(3);
      expect(result.allocations).toEqual([
        { batchId: null, batchNo: '', quantity: 5, costCents: 90 },
      ]);
    });

    it('does not change the product it is given', () => {
      const before = structuredClone(TWO_BATCHES);
      allocateStock(TWO_BATCHES, 8, TODAY, true);
      expect(TWO_BATCHES).toEqual(before);
    });
  });
});
