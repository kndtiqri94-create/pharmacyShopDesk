import {
  TEST_TODAY,
  testBatch,
  testBill,
  testBillLine,
  testProduct,
} from '../../../testing/pos-test.util';
import {
  prepareQuotationForInvoice,
  quotationTotalCents,
  snapshotQuotationBill,
} from './pos-quotation.util';
import { POS_SETTINGS_DEFAULTS } from './pos-settings.util';

const customers = [
  { id: 'cus-001', name: 'Walk-in Customer', isWalkIn: true },
  { id: 'cus-002', name: 'Sunil Rathnayake', isWalkIn: false },
];

const context = (overrides: Partial<Parameters<typeof prepareQuotationForInvoice>[1]> = {}) => ({
  products: [testProduct()],
  customers,
  reps: [],
  settings: POS_SETTINGS_DEFAULTS,
  today: TEST_TODAY,
  blockExpired: true,
  invoiceNo: 'INV-0009',
  ...overrides,
});

describe('pos quotation util', () => {
  it('snapshots a bill without payments or an invoice number, as a copy', () => {
    const bill = testBill();
    const snapshot = snapshotQuotationBill(bill);
    expect(snapshot.invoiceNo).toBe('');
    expect(snapshot.payments.cash).toBe('');
    expect(snapshot.lines).toEqual(bill.lines);
    snapshot.lines[0].quantity = 99;
    expect(bill.lines[0].quantity).toBe(4);
  });

  it('totals a quotation after its discounts', () => {
    expect(quotationTotalCents(testBill())).toBe(1000);
    expect(quotationTotalCents(testBill({ billDiscount: { mode: 'PERCENT', percent: 10 } }))).toBe(
      900
    );
  });

  it('turns a quotation into an invoice bill dated today with the new number', () => {
    const result = prepareQuotationForInvoice(snapshotQuotationBill(testBill()), context());
    expect(result.bill.invoiceNo).toBe('INV-0009');
    expect(result.bill.date).toBe(TEST_TODAY);
    expect(result.notes).toEqual([]);
    expect(result.needsApproval).toBeFalse();
  });

  it('uses current prices and tells the user', () => {
    const result = prepareQuotationForInvoice(
      snapshotQuotationBill(testBill()),
      context({ products: [testProduct({ priceCents: 400 })] })
    );
    expect(result.bill.lines[0].unitPriceCents).toBe(400);
    expect(result.notes.join(' ')).toContain('Rs. 4.00');
  });

  it('flags a product that sold out, expired or is gone, and keeps the line', () => {
    const soldOut = prepareQuotationForInvoice(
      snapshotQuotationBill(testBill()),
      context({ products: [testProduct({ batches: [testBatch({ quantity: 0 })] })] })
    );
    expect(soldOut.notes.join(' ')).toContain('out of stock');
    const expired = prepareQuotationForInvoice(
      snapshotQuotationBill(testBill()),
      context({ products: [testProduct({ batches: [testBatch({ expiryDate: '2026-01-01' })] })] })
    );
    expect(expired.notes.join(' ')).toContain('expired');
    const gone = prepareQuotationForInvoice(
      snapshotQuotationBill(testBill()),
      context({ products: [] })
    );
    expect(gone.notes.join(' ')).toContain('no longer for sale');
    expect(gone.bill.lines).toHaveSize(1);
  });

  it('flags a quantity above what is available', () => {
    const bill = testBill({ lines: [testBillLine('prod-001', 500)] });
    const result = prepareQuotationForInvoice(snapshotQuotationBill(bill), context());
    expect(result.notes.join(' ')).toContain('Only 100');
  });

  it('drops old approvals and asks again for a non default discount', () => {
    const approval = {
      scope: 'LINE' as const,
      productId: 'prod-001',
      percent: 10,
      approverUserId: 'usr-001',
      approverName: 'Nimal Perera',
      approvedAt: '2026-09-20T10:00:00',
    };
    const bill = testBill({
      lines: [{ ...testBillLine('prod-001', 2), discountPercent: 10, discountApproval: approval }],
    });
    const result = prepareQuotationForInvoice(snapshotQuotationBill(bill), context());
    expect(result.needsApproval).toBeTrue();
    expect(result.bill.lines[0].discountApproval).toBeNull();
    expect(result.bill.lines[0].discountPercent).toBe(10);
  });

  it('falls back to the Walk-in Customer when the customer is gone', () => {
    const bill = testBill({ customerId: 'cus-099' });
    const result = prepareQuotationForInvoice(snapshotQuotationBill(bill), context());
    expect(result.bill.customerId).toBe('cus-001');
  });
});
