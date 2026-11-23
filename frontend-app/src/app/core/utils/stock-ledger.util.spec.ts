import { StockMovement } from '../models/domain/stock-movement.model';
import { StockMovementType } from '../models/enums/stock-movement-type.enum';
import { batchKey, mergeMovements, sumMovements } from './stock-ledger.util';

function movement(id: string, qtyDelta: number, batchId = 'bat-1'): StockMovement {
  return {
    id,
    seq: 1,
    productId: 'prod-1',
    batchId,
    type: StockMovementType.SALE,
    qtyDelta,
    refId: null,
    userId: null,
    deviceCode: 'AAA',
    createdAt: '2026-09-21T10:00:00',
  };
}

describe('stock-ledger.util', () => {
  it('adds movements up per product and per batch', () => {
    const sums = sumMovements([movement('a', -4), movement('b', 10), movement('c', -1, 'bat-2')]);
    expect(sums.byProduct.get('prod-1')).toBe(5);
    expect(sums.byBatch.get(batchKey('prod-1', 'bat-1'))).toBe(6);
    expect(sums.byBatch.get(batchKey('prod-1', 'bat-2'))).toBe(-1);
  });

  it('counts a movement from another device once, however many times it arrives', () => {
    const own = [movement('a', -2)];
    const theirs = [movement('b', -3), movement('b', -3)];
    const merged = mergeMovements(mergeMovements(own, theirs), theirs);
    expect(merged.map(item => item.id)).toEqual(['a', 'b']);
    expect(sumMovements(merged).byProduct.get('prod-1')).toBe(-5);
  });
});
