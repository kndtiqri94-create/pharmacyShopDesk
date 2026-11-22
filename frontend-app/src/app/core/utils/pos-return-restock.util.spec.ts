import { TEST_TODAY, testBatch, testProduct, testSaleLine } from '../../../testing/pos-test.util';
import { restockReturnLine } from './pos-return-restock.util';

const base = (overrides: Partial<Parameters<typeof restockReturnLine>[0]> = {}) => ({
  product: testProduct({
    batches: [
      testBatch({ id: 'bat-a', expiryDate: '2027-01-31', quantity: 10 }),
      testBatch({ id: 'bat-b', expiryDate: '2028-01-31', quantity: 20 }),
    ],
  }),
  saleLine: testSaleLine({
    quantity: 5,
    batchAllocations: [{ batchId: 'bat-b', batchNo: 'B', quantity: 5, costCents: 100 }],
  }),
  priorAllocations: [],
  quantity: 3,
  today: TEST_TODAY,
  blockExpired: true,
  ...overrides,
});

describe('pos return restock util', () => {
  it('puts stock back into the batch it was sold from', () => {
    const result = restockReturnLine(base());
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.allocations).toEqual([
      { batchId: 'bat-b', batchNo: 'B1', quantity: 3, costCents: 100 },
    ]);
    expect(result.product.batches.find(batch => batch.id === 'bat-b')?.quantity).toBe(23);
    expect(result.product.batches.find(batch => batch.id === 'bat-a')?.quantity).toBe(10);
  });

  it('does not put back more into a batch than was taken from it', () => {
    const result = restockReturnLine(
      base({
        quantity: 5,
        priorAllocations: [{ batchId: 'bat-b', batchNo: 'B', quantity: 3, costCents: 100 }],
      })
    );
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    const quantityIn = (id: string) =>
      result.allocations.find(allocation => allocation.batchId === id)?.quantity ?? 0;
    expect(quantityIn('bat-b')).toBe(2);
    expect(quantityIn('bat-a')).toBe(3);
  });

  it('falls back to the batch that sells first when the original batch is gone', () => {
    const result = restockReturnLine(
      base({
        saleLine: testSaleLine({
          batchAllocations: [{ batchId: 'bat-gone', batchNo: 'X', quantity: 5, costCents: 90 }],
        }),
      })
    );
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.allocations[0].batchId).toBe('bat-a');
    expect(result.product.batches.find(batch => batch.id === 'bat-a')?.quantity).toBe(13);
  });

  it('never restocks silently into an expired batch that sales are blocked for', () => {
    const product = testProduct({
      batches: [
        testBatch({ id: 'bat-old', expiryDate: '2026-01-31', quantity: 4 }),
        testBatch({ id: 'bat-new', expiryDate: '2028-01-31', quantity: 4 }),
      ],
    });
    const result = restockReturnLine(
      base({
        product,
        saleLine: testSaleLine({
          batchAllocations: [{ batchId: 'bat-old', batchNo: 'O', quantity: 5, costCents: 100 }],
        }),
      })
    );
    expect(result.ok && result.allocations[0].batchId).toBe('bat-new');
  });

  it('refuses when every batch is expired and blocked', () => {
    const product = testProduct({
      batches: [testBatch({ id: 'bat-old', expiryDate: '2026-01-31', quantity: 4 })],
    });
    const result = restockReturnLine(base({ product }));
    expect(result.ok).toBeFalse();
  });

  it('adds to the stock figure for a product without batches', () => {
    const product = testProduct({ trackBatches: false, batches: [], stockOnHand: 7 });
    const result = restockReturnLine(base({ product }));
    expect(result.ok && result.product.stockOnHand).toBe(10);
    expect(result.ok && result.allocations[0].batchId).toBeNull();
  });

  it('refuses a zero, negative or fractional quantity', () => {
    for (const quantity of [0, -1, 1.5, Number.NaN]) {
      expect(restockReturnLine(base({ quantity })).ok)
        .withContext(String(quantity))
        .toBeFalse();
    }
  });
});
