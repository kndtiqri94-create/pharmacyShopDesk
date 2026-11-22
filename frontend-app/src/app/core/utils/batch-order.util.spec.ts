import { Batch } from '../models/domain/batch.model';
import { getEarliestBatchInStock, sortBatchesByExpiry } from './batch-order.util';

describe('batch-order.util', () => {
  const batches: Batch[] = [
    { id: '1', batchNo: 'LATE', expiryDate: '2028-01-31', quantity: 1, costCents: 1 },
    { id: '2', batchNo: 'EARLY', expiryDate: '2027-03-31', quantity: 1, costCents: 1 },
    { id: '3', batchNo: 'MID', expiryDate: '2027-08-31', quantity: 1, costCents: 1 },
  ];

  it('orders earliest-expiring batch first', () => {
    expect(sortBatchesByExpiry(batches).map(batch => batch.batchNo)).toEqual([
      'EARLY',
      'MID',
      'LATE',
    ]);
  });

  it('does not change the input array', () => {
    sortBatchesByExpiry(batches);
    expect(batches[0].batchNo).toBe('LATE');
  });

  it('finds the earliest-expiring batch that still has stock', () => {
    expect(getEarliestBatchInStock(batches)?.batchNo).toBe('EARLY');
    const emptyEarly = batches.map(batch =>
      batch.batchNo === 'EARLY' ? { ...batch, quantity: 0 } : batch
    );
    expect(getEarliestBatchInStock(emptyEarly)?.batchNo).toBe('MID');
    expect(getEarliestBatchInStock([])).toBeNull();
  });
});
