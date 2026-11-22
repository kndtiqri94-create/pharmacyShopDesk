import { PRODUCT_SEED } from '../services/data/in-memory/seed/product.seed';
import {
  computePurchaseOrderTotals,
  isLowStock,
  purchaseOrderLineTotalCents,
  suggestLowStockLines,
  suggestOrderQuantity,
} from './purchase-order-totals.util';

describe('purchase-order-totals.util', () => {
  const lines = [
    { quantity: 200, unitCostCents: 1250 },
    { quantity: 100, unitCostCents: 4500 },
  ];

  it('multiplies quantity by unit cost for a line', () => {
    expect(purchaseOrderLineTotalCents(lines[0])).toBe(250_000);
  });

  it('adds delivery to the sub-total and counts lines and units', () => {
    const totals = computePurchaseOrderTotals(lines, 5_000);
    expect(totals).toEqual({
      lineCount: 2,
      unitCount: 300,
      subTotalCents: 700_000,
      deliveryCents: 5_000,
      totalCents: 705_000,
    });
  });

  it('handles an order with no lines', () => {
    expect(computePurchaseOrderTotals([], 0).totalCents).toBe(0);
  });

  it('suggests a quantity that brings stock back above the reorder level', () => {
    const orsachet = PRODUCT_SEED.find(product => product.id === 'prod-006')!;
    expect(suggestOrderQuantity(orsachet)).toBe(100);
    const metformin = PRODUCT_SEED.find(product => product.id === 'prod-008')!;
    expect(suggestOrderQuantity(metformin)).toBe(340);
    expect(isLowStock(metformin)).toBeTrue();
  });

  it('suggests a line for every low-stock active product', () => {
    const ids = suggestLowStockLines(PRODUCT_SEED, []).map(line => line.productId);
    expect(ids).toContain('prod-006');
    expect(ids).toContain('prod-008');
    expect(ids).not.toContain('prod-010');
  });

  it('does not duplicate products already on the order', () => {
    const ids = suggestLowStockLines(PRODUCT_SEED, ['prod-006']).map(line => line.productId);
    expect(ids).not.toContain('prod-006');
  });

  it('suggests nothing when no product is low or the products are inactive', () => {
    const stocked = PRODUCT_SEED.map(product => ({ ...product, reorderLevel: 0, stockOnHand: 99 }));
    expect(suggestLowStockLines(stocked, [])).toEqual([]);
    const inactive = PRODUCT_SEED.map(product => ({ ...product, active: false }));
    expect(suggestLowStockLines(inactive, [])).toEqual([]);
  });
});
