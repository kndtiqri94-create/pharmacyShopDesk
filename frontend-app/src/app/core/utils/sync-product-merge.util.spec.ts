import { testProduct } from '../../../testing/pos-test.util';
import { mergePulledProduct } from './sync-product-merge.util';

describe('mergePulledProduct', () => {
  it('takes the central product as is when the device has no copy', () => {
    const server = testProduct({ id: 'p1', stockOnHand: 7 });
    expect(mergePulledProduct(undefined, server)).toEqual(server);
  });

  it('takes central details but keeps the device stock base', () => {
    const local = testProduct({ id: 'p1', stockOnHand: 40, priceCents: 100 });
    const server = testProduct({ id: 'p1', stockOnHand: 999, priceCents: 250, name: 'Central' });
    const merged = mergePulledProduct(local, server);
    expect(merged.priceCents).toBe(250);
    expect(merged.name).toBe('Central');
    expect(merged.stockOnHand).toBe(40);
  });

  it('keeps device batch quantities, and uses the central base only for new batches', () => {
    const batch = (id: string, quantity: number) => ({
      id,
      batchNo: id,
      expiryDate: '2027-01-01',
      quantity,
      costCents: 10,
    });
    const local = testProduct({ id: 'p1', batches: [batch('b1', 11)] });
    const server = testProduct({ id: 'p1', batches: [batch('b1', 500), batch('b2', 30)] });
    const merged = mergePulledProduct(local, server);
    expect(merged.batches.map(item => [item.id, item.quantity])).toEqual([
      ['b1', 11],
      ['b2', 30],
    ]);
  });
});
