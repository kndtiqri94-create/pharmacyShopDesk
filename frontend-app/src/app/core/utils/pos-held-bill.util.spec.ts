import { Bill } from '../models/domain/bill.model';
import { BillLine } from '../models/domain/bill-line.model';
import { DiscountApproval } from '../models/domain/discount-approval.model';
import { PosSettings } from '../models/domain/pos-settings.model';
import { Product } from '../models/domain/product.model';
import { POS_CUSTOMER_SEED, SALES_REP_SEED } from '../services/data/in-memory/seed/pos.seed';
import { PRODUCT_SEED } from '../services/data/in-memory/seed/product.seed';
import { RepriceContext, repriceHeldBill } from './pos-held-bill.util';

const SETTINGS: PosSettings = {
  lineDiscountEnabled: true,
  billDiscountEnabled: true,
  defaultDiscountPercent: 0,
  maxDiscountPercent: 20,
  hideSidebarOnOpen: true,
};

const PARACETAMOL = PRODUCT_SEED[0];

const approval = (overrides: Partial<DiscountApproval> = {}): DiscountApproval => ({
  scope: 'LINE',
  productId: PARACETAMOL.id,
  percent: 10,
  approverUserId: 'usr-001',
  approverName: 'Nimal Perera',
  approvedAt: '2026-09-21T10:00:00',
  ...overrides,
});

function line(overrides: Partial<BillLine> = {}): BillLine {
  return {
    productId: PARACETAMOL.id,
    sku: PARACETAMOL.sku,
    name: PARACETAMOL.name,
    barcode: PARACETAMOL.barcode,
    unitPriceCents: PARACETAMOL.priceCents,
    discountPercent: 0,
    quantity: 4,
    discountApproval: null,
    ...overrides,
  };
}

function bill(overrides: Partial<Bill> = {}): Bill {
  return {
    invoiceNo: 'INV-0004',
    date: '2026-09-21',
    customerId: 'cus-002',
    repId: 'rep-001',
    lines: [line()],
    billDiscount: { mode: 'PERCENT', percent: 0 },
    billDiscountApproval: null,
    payments: {
      cash: '5',
      card: '',
      online: '',
      cardReference: '',
      onlineReference: '',
      creditSelected: false,
    },
    ...overrides,
  };
}

function context(overrides: Partial<RepriceContext> = {}): RepriceContext {
  return {
    products: structuredClone(PRODUCT_SEED) as Product[],
    settings: SETTINGS,
    customers: POS_CUSTOMER_SEED,
    reps: SALES_REP_SEED,
    today: '2026-09-21',
    blockExpired: true,
    ...overrides,
  };
}

describe('repriceHeldBill', () => {
  it('brings back the same lines, customer, rep, discount and payment entries when nothing changed', () => {
    const stored = bill({
      lines: [line({ discountPercent: 10, discountApproval: approval() })],
      billDiscount: { mode: 'PERCENT', percent: 5 },
      billDiscountApproval: approval({ scope: 'BILL', productId: null, percent: 5 }),
    });
    const { bill: restored, notes } = repriceHeldBill(stored, context());
    expect(restored).toEqual(stored);
    expect(notes).toEqual([]);
  });

  it('does not change the stored bill', () => {
    const stored = bill();
    const before = structuredClone(stored);
    repriceHeldBill(stored, context({ settings: { ...SETTINGS, maxDiscountPercent: 1 } }));
    expect(stored).toEqual(before);
  });

  it('re-prices a line from the fresh product and says so', () => {
    const products = structuredClone(PRODUCT_SEED) as Product[];
    products[0].priceCents = 300;
    const { bill: restored, notes } = repriceHeldBill(bill(), context({ products }));
    expect(restored.lines[0].unitPriceCents).toBe(300);
    expect(notes.join(' ')).toContain('Rs. 3.00');
  });

  it('reduces a quantity that is now more than the stock', () => {
    const products = structuredClone(PRODUCT_SEED) as Product[];
    for (const batch of products[0].batches) batch.quantity = 0;
    products[0].batches[0].quantity = 2;
    const { bill: restored, notes } = repriceHeldBill(bill(), context({ products }));
    expect(restored.lines[0].quantity).toBe(2);
    expect(notes.join(' ')).toContain('reduced to 2');
  });

  it('removes a line that is out of stock, expired or switched off', () => {
    const empty = structuredClone(PRODUCT_SEED) as Product[];
    for (const batch of empty[0].batches) batch.quantity = 0;
    expect(repriceHeldBill(bill(), context({ products: empty })).bill.lines).toEqual([]);
    const expired = structuredClone(PRODUCT_SEED) as Product[];
    expired[0].batches = [
      { id: 'old', batchNo: 'O', expiryDate: '2026-08-31', quantity: 9, costCents: 1 },
    ];
    expect(repriceHeldBill(bill(), context({ products: expired })).bill.lines).toEqual([]);
    const off = structuredClone(PRODUCT_SEED) as Product[];
    off[0].active = false;
    const { bill: restored, notes } = repriceHeldBill(bill(), context({ products: off }));
    expect(restored.lines).toEqual([]);
    expect(notes[0]).toContain('no longer for sale');
  });

  it('resets a line discount when the maximum was lowered or line discount was turned off', () => {
    const stored = bill({
      lines: [line({ discountPercent: 15, discountApproval: approval({ percent: 15 }) })],
    });
    const lowered = repriceHeldBill(
      stored,
      context({ settings: { ...SETTINGS, maxDiscountPercent: 10 } })
    );
    expect(lowered.bill.lines[0].discountPercent).toBe(0);
    expect(lowered.bill.lines[0].discountApproval).toBeNull();
    expect(lowered.notes.join(' ')).toContain('reset to the default');
    const off = repriceHeldBill(
      stored,
      context({ settings: { ...SETTINGS, lineDiscountEnabled: false } })
    );
    expect(off.bill.lines[0].discountPercent).toBe(0);
  });

  it('resets a line discount that has no matching approval', () => {
    const stored = bill({ lines: [line({ discountPercent: 15 })] });
    expect(repriceHeldBill(stored, context()).bill.lines[0].discountPercent).toBe(0);
  });

  it('resets a bill discount that is no longer allowed', () => {
    const stored = bill({
      billDiscount: { mode: 'PERCENT', percent: 15 },
      billDiscountApproval: approval({ scope: 'BILL', productId: null, percent: 15 }),
    });
    const { bill: restored, notes } = repriceHeldBill(
      stored,
      context({ settings: { ...SETTINGS, maxDiscountPercent: 10 } })
    );
    expect(restored.billDiscount).toEqual({ mode: 'PERCENT', percent: 0 });
    expect(restored.billDiscountApproval).toBeNull();
    expect(notes.join(' ')).toContain('bill discount');
  });

  it('falls back to Walk-in for a missing customer and clears a missing rep', () => {
    const { bill: restored } = repriceHeldBill(
      bill({ customerId: 'cus-999', repId: 'rep-999' }),
      context()
    );
    expect(restored.customerId).toBe('cus-001');
    expect(restored.repId).toBeNull();
  });

  it('never leaves a bill dated in the future', () => {
    expect(repriceHeldBill(bill({ date: '2026-10-01' }), context()).bill.date).toBe('2026-09-21');
  });
});
