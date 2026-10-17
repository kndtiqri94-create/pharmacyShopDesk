import { Grn } from '../models/domain/grn.model';
import { PurchaseOrder } from '../models/domain/purchase-order.model';
import { SupplierPayment } from '../models/domain/supplier-payment.model';
import { PoStatus } from '../models/enums/po-status.enum';
import { GRN_SEED } from '../services/data/in-memory/seed/grn.seed';
import { PURCHASE_ORDER_SEED } from '../services/data/in-memory/seed/purchase-order.seed';
import { SUPPLIER_PAYMENT_SEED } from '../services/data/in-memory/seed/supplier-payment.seed';
import { buildSupplierActivity } from './supplier-activity.util';

const TODAY = '2026-09-21';
const sources = { orders: PURCHASE_ORDER_SEED, grns: GRN_SEED, payments: SUPPLIER_PAYMENT_SEED };

describe('supplier-activity.util', () => {
  it('shows a sent order as Overdue and a received GRN as Unpaid, newest first', () => {
    const items = buildSupplierActivity('sup-001', sources, TODAY);
    expect(items.map(item => `${item.text} / ${item.stateLabel}`)).toEqual([
      'GRN-0208 received / Unpaid',
      'PO-0148 sent / Overdue',
      'GRN-0206 received / Part paid',
      'GRN-0205 received / Unpaid',
    ]);
  });

  it('includes payments as Paid', () => {
    const items = buildSupplierActivity('sup-003', sources, TODAY);
    expect(
      items.some(item => item.text === 'Payment of Rs. 2,000' && item.stateLabel === 'Paid')
    ).toBeTrue();
  });

  it('shows at most five events, and drafts are left out', () => {
    const grns: Grn[] = Array.from({ length: 8 }, (_, index) => ({
      ...GRN_SEED[0],
      id: `g-${index}`,
      number: `GRN-00${index}`,
      receivedDate: `2026-09-0${index + 1}`,
    }));
    const draft: PurchaseOrder = {
      ...PURCHASE_ORDER_SEED[0],
      status: PoStatus.DRAFT,
      supplierId: 'sup-001',
    };
    const items = buildSupplierActivity('sup-001', { orders: [draft], grns, payments: [] }, TODAY);
    expect(items).toHaveSize(5);
    expect(items[0].text).toBe('GRN-007 received');
  });

  it('puts a payment recorded today above other events from the same day', () => {
    const payment: SupplierPayment = {
      id: 'pay-009',
      supplierId: 'sup-001',
      paidDate: '2026-09-21',
      amountCents: 100_000,
      allocations: [],
      recordedBy: 'Kamal Silva',
    };
    const todayGrn: Grn = {
      ...GRN_SEED[0],
      id: 'g-new',
      number: 'GRN-0300',
      receivedDate: '2026-09-21',
    };
    const items = buildSupplierActivity(
      'sup-001',
      { orders: [], grns: [todayGrn], payments: [payment] },
      TODAY
    );
    expect(items[0].text).toBe('Payment of Rs. 1,000');
  });

  it('only includes events of the chosen supplier', () => {
    const items = buildSupplierActivity('sup-004', sources, TODAY);
    expect(items.every(item => !item.text.includes('GRN-0208'))).toBeTrue();
  });
});
