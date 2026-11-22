import { GrnLine } from '../models/domain/grn-line.model';
import { PoStatus } from '../models/enums/po-status.enum';
import { ProductStatus } from '../models/enums/product-status.enum';
import { PRODUCT_SEED } from '../services/data/in-memory/seed/product.seed';
import { PURCHASE_ORDER_SEED } from '../services/data/in-memory/seed/purchase-order.seed';
import { applyGrnToOrder, applyGrnToProducts } from './grn-receiving.util';
import { getProductStatus, getStockOnHand } from './stock-status.util';

const line = (overrides: Partial<GrnLine>): GrnLine => ({
  productId: 'prod-002',
  batchNo: 'B2602',
  expiryDate: '2027-02-28',
  receivedQuantity: 200,
  freeQuantity: 20,
  costCents: 1300,
  priceCents: 1800,
  ...overrides,
});

describe('grn-receiving.util', () => {
  it('adds a batch, raises stock by received plus free and sets the cost price', () => {
    const before = PRODUCT_SEED.find(product => product.id === 'prod-002');
    const [after] = applyGrnToProducts([line({})], PRODUCT_SEED);
    expect(after.batches).toHaveSize(2);
    expect(getStockOnHand(after)).toBe(getStockOnHand(before!) + 220);
    expect(after.costCents).toBe(1300);
    expect(after.priceCents).toBe(before!.priceCents);
    const added = after.batches.find(batch => batch.batchNo === 'B2602');
    expect(added?.quantity).toBe(220);
    expect(added?.id).toBe('bat-010');
  });

  it('keeps batches earliest-expiring first', () => {
    const [after] = applyGrnToProducts([line({ expiryDate: '2026-10-31' })], PRODUCT_SEED);
    expect(after.batches.map(batch => batch.batchNo)).toEqual(['B2602', 'B2406']);
  });

  it('recalculates the stock status from the new stock', () => {
    const before = PRODUCT_SEED.find(product => product.id === 'prod-006')!;
    expect(getProductStatus(before, 60, '2026-09-21')).toBe(ProductStatus.OUT_OF_STOCK);
    const [after] = applyGrnToProducts(
      [line({ productId: 'prod-006', receivedQuantity: 100, freeQuantity: 0 })],
      PRODUCT_SEED
    );
    expect(getProductStatus(after, 60, '2026-09-21')).toBe(ProductStatus.IN_STOCK);
  });

  it('merges a repeat of the same batch and expiry into one batch', () => {
    const [after] = applyGrnToProducts(
      [line({}), line({ receivedQuantity: 10, freeQuantity: 0 })],
      PRODUCT_SEED
    );
    expect(after.batches.filter(batch => batch.batchNo === 'B2602')).toHaveSize(1);
    expect(after.batches.find(batch => batch.batchNo === 'B2602')?.quantity).toBe(230);
  });

  it('adds stock without a batch for a product that does not track batches', () => {
    const [after] = applyGrnToProducts(
      [line({ productId: 'prod-010', expiryDate: null, batchNo: 'X' })],
      PRODUCT_SEED
    );
    expect(after.batches).toEqual([]);
    expect(after.stockOnHand).toBe(24 + 220);
  });

  it('ignores a product that does not exist and never changes its inputs', () => {
    const snapshot = structuredClone(PRODUCT_SEED);
    expect(applyGrnToProducts([line({ productId: 'prod-999' })], PRODUCT_SEED)).toEqual([]);
    applyGrnToProducts([line({})], PRODUCT_SEED);
    expect(PRODUCT_SEED).toEqual(snapshot);
  });

  it('closes a PO when everything ordered is received', () => {
    const order = PURCHASE_ORDER_SEED.find(item => item.id === 'po-004')!;
    const updated = applyGrnToOrder(
      [line({ receivedQuantity: 200 }), line({ productId: 'prod-006', receivedQuantity: 100 })],
      order
    );
    expect(updated.status).toBe(PoStatus.RECEIVED);
  });

  it('part-closes a PO when some quantity is still outstanding', () => {
    const order = PURCHASE_ORDER_SEED.find(item => item.id === 'po-004')!;
    const updated = applyGrnToOrder([line({ receivedQuantity: 50 })], order);
    expect(updated.status).toBe(PoStatus.PART_RECEIVED);
    expect(updated.lines[0].receivedQuantity).toBe(50);
  });

  it('lets a later GRN complete a part received PO', () => {
    const order = PURCHASE_ORDER_SEED.find(item => item.id === 'po-003')!;
    const first = applyGrnToOrder([line({ productId: 'prod-001', receivedQuantity: 1000 })], order);
    expect(first.status).toBe(PoStatus.PART_RECEIVED);
    const second = applyGrnToOrder([line({ productId: 'prod-005', receivedQuantity: 500 })], first);
    expect(second.status).toBe(PoStatus.RECEIVED);
  });

  it('leaves a PO that is not open untouched', () => {
    const received = PURCHASE_ORDER_SEED.find(item => item.status === PoStatus.RECEIVED)!;
    expect(applyGrnToOrder([line({ productId: 'prod-004' })], received)).toEqual(received);
  });

  it('keeps the PO status when none of its products were received', () => {
    const order = PURCHASE_ORDER_SEED.find(item => item.id === 'po-004')!;
    expect(applyGrnToOrder([line({ productId: 'prod-010' })], order).status).toBe(PoStatus.SENT);
  });
});
