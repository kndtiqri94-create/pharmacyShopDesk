import { PoStatus } from '../models/enums/po-status.enum';
import { PURCHASE_ORDER_SEED } from '../services/data/in-memory/seed/purchase-order.seed';
import { isPurchaseOrderOverdue } from './purchase-order-overdue.util';

const TODAY = '2026-09-21';

describe('purchase-order-overdue.util', () => {
  it('flags a sent order past its expected date', () => {
    const sent = PURCHASE_ORDER_SEED.find(order => order.status === PoStatus.SENT);
    expect(sent && isPurchaseOrderOverdue(sent, TODAY)).toBeTrue();
  });

  it('does not flag orders that are not waiting for stock', () => {
    const closed = PURCHASE_ORDER_SEED.filter(order =>
      ([PoStatus.RECEIVED, PoStatus.CANCELLED, PoStatus.DRAFT] as string[]).includes(order.status)
    );
    expect(closed.some(order => isPurchaseOrderOverdue(order, TODAY))).toBeFalse();
  });

  it('does not flag an order due today', () => {
    const sent = { ...PURCHASE_ORDER_SEED[3], expectedDate: TODAY };
    expect(isPurchaseOrderOverdue(sent, TODAY)).toBeFalse();
  });
});
