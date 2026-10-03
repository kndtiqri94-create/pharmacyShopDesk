import { Product } from '../models/domain/product.model';
import { ProductStatus } from '../models/enums/product-status.enum';
import { PRODUCT_SEED } from '../services/data/in-memory/seed/product.seed';
import { getNearestExpiry, getProductStatus, getStockOnHand } from './stock-status.util';

const TODAY = '2026-09-21';

function product(overrides: Partial<Product>): Product {
  return { ...structuredClone(PRODUCT_SEED[0]), ...overrides };
}

describe('stock-status.util', () => {
  it('reports out of stock at zero', () => {
    expect(getProductStatus(product({ batches: [] }), 60, TODAY)).toBe(ProductStatus.OUT_OF_STOCK);
  });

  it('reports low stock at or below the reorder level', () => {
    const atLevel = product({
      reorderLevel: 100,
      batches: [{ id: 'b', batchNo: 'B1', expiryDate: '2030-01-31', quantity: 100, costCents: 1 }],
    });
    expect(getProductStatus(atLevel, 60, TODAY)).toBe(ProductStatus.LOW_STOCK);
  });

  it('reports expiring soon when the nearest batch is inside the alert window', () => {
    const expiring = product({
      reorderLevel: 10,
      batches: [{ id: 'b', batchNo: 'B1', expiryDate: '2026-11-20', quantity: 50, costCents: 1 }],
    });
    expect(getProductStatus(expiring, 60, TODAY)).toBe(ProductStatus.EXPIRING_SOON);
    expect(getProductStatus(expiring, 59, TODAY)).toBe(ProductStatus.IN_STOCK);
  });

  it('ignores empty batches when finding the nearest expiry', () => {
    const mixed = product({
      batches: [
        { id: 'a', batchNo: 'A', expiryDate: '2026-10-01', quantity: 0, costCents: 1 },
        { id: 'b', batchNo: 'B', expiryDate: '2027-01-01', quantity: 5, costCents: 1 },
      ],
    });
    expect(getNearestExpiry(mixed)).toBe('2027-01-01');
  });

  it('uses the single stock figure when batch tracking is off', () => {
    const untracked = product({
      trackBatches: false,
      stockOnHand: 24,
      reorderLevel: 10,
      batches: [],
    });
    expect(getStockOnHand(untracked)).toBe(24);
    expect(getNearestExpiry(untracked)).toBeNull();
    expect(getProductStatus(untracked, 60, TODAY)).toBe(ProductStatus.IN_STOCK);
  });

  it('uses the recorded stock for a batch-tracked product that has no batches yet', () => {
    const newProduct = product({
      trackBatches: true,
      stockOnHand: 40,
      batches: [],
      reorderLevel: 10,
    });
    expect(getStockOnHand(newProduct)).toBe(40);
    expect(getNearestExpiry(newProduct)).toBeNull();
    expect(getProductStatus(newProduct, 60, TODAY)).toBe(ProductStatus.IN_STOCK);
  });

  it('shows Low stock before Expiring soon and Out of stock before everything', () => {
    const batch = { id: 'b', batchNo: 'B1', expiryDate: '2026-10-01', quantity: 10, costCents: 1 };
    const lowAndExpiring = product({ reorderLevel: 50, batches: [batch] });
    expect(getProductStatus(lowAndExpiring, 60, TODAY)).toBe(ProductStatus.LOW_STOCK);
    const outAndExpired = product({ reorderLevel: 50, batches: [{ ...batch, quantity: 0 }] });
    expect(getProductStatus(outAndExpired, 60, TODAY)).toBe(ProductStatus.OUT_OF_STOCK);
  });
});
