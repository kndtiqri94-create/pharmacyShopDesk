import { PoStatus } from '../models/enums/po-status.enum';
import { PURCHASE_ORDER_SEED } from '../services/data/in-memory/seed/purchase-order.seed';
import { SUPPLIER_SEED } from '../services/data/in-memory/seed/supplier.seed';
import {
  countOverdueOrders,
  countPurchaseOrdersByStatus,
  filterPurchaseOrderItems,
  parsePoStatusFilter,
  recentRange,
  toPurchaseOrderListItems,
} from './purchase-order-list-filter.util';

const TODAY = '2026-09-21';
const range = recentRange(TODAY);
const items = toPurchaseOrderListItems(PURCHASE_ORDER_SEED, SUPPLIER_SEED, TODAY);
const criteria = { search: '', status: 'all' as const, range };

describe('purchase-order-list-filter.util', () => {
  it('uses the last 30 days as the range', () => {
    expect(range).toEqual({ from: '2026-08-22', to: '2026-09-21' });
  });

  it('lists newest first with the supplier contact underneath', () => {
    expect(items.map(item => item.order.number)).toEqual([
      'PO-0149',
      'PO-0147',
      'PO-0148',
      'PO-0145',
      'PO-0146',
    ]);
    expect(items[0].contactSummary).toBe('Contact: Nadeesha Rathnayake');
  });

  it('marks an overdue open order with the word overdue and never a closed one', () => {
    const sent = items.find(item => item.order.number === 'PO-0148');
    expect(sent?.overdue).toBeTrue();
    expect(sent?.expectedLabel).toBe('20 Sep · overdue');
    const received = items.find(item => item.order.number === 'PO-0145');
    expect(received?.overdue).toBeFalse();
    expect(received?.expectedLabel).toBe('10 Sep');
    expect(countOverdueOrders(items)).toBe(1);
  });

  it('searches PO number and supplier ignoring case', () => {
    const numbers = (search: string) =>
      filterPurchaseOrderItems(items, { ...criteria, search }).map(item => item.order.number);
    expect(numbers('po-0148')).toEqual(['PO-0148']);
    expect(numbers('CITY')).toEqual(['PO-0147', 'PO-0145']);
    expect(numbers('nothing')).toEqual([]);
  });

  it('counts each status chip and filters by one status', () => {
    expect(countPurchaseOrdersByStatus(items, { search: '', range })).toEqual({
      all: 5,
      draft: 1,
      sent: 1,
      'part-received': 1,
      received: 1,
      cancelled: 1,
    });
    const sent = filterPurchaseOrderItems(items, { ...criteria, status: 'sent' });
    expect(sent.map(item => item.order.status)).toEqual([PoStatus.SENT]);
  });

  it('leaves out old orders but keeps drafts', () => {
    const later = { from: '2026-09-15', to: '2026-09-21' };
    const result = filterPurchaseOrderItems(items, { ...criteria, range: later });
    expect(result.map(item => item.order.number)).toEqual(['PO-0149']);
  });

  it('falls back to All for an unknown status', () => {
    expect(parsePoStatusFilter('part-received')).toBe('part-received');
    expect(parsePoStatusFilter('bogus')).toBe('all');
    expect(parsePoStatusFilter(null)).toBe('all');
  });
});
