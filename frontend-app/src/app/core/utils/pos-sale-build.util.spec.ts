import { Bill } from '../models/domain/bill.model';
import { BillLine } from '../models/domain/bill-line.model';
import { DiscountApproval } from '../models/domain/discount-approval.model';
import { PosSettings } from '../models/domain/pos-settings.model';
import { Product } from '../models/domain/product.model';
import { Sale } from '../models/domain/sale.model';
import { POS_CUSTOMER_SEED, SALES_REP_SEED } from '../services/data/in-memory/seed/pos.seed';
import { PRODUCT_SEED } from '../services/data/in-memory/seed/product.seed';
import { SaleBuildContext, buildSale } from './pos-sale-build.util';

const SETTINGS: PosSettings = {
  lineDiscountEnabled: true,
  billDiscountEnabled: true,
  defaultDiscountPercent: 0,
  maxDiscountPercent: 20,
  hideSidebarOnOpen: true,
};

const PARACETAMOL = PRODUCT_SEED[0];
const NAMED_CUSTOMER = 'cus-002';
const WALK_IN = 'cus-001';

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
    invoiceNo: 'INV-0001',
    date: '2026-09-21',
    customerId: WALK_IN,
    repId: null,
    lines: [line()],
    billDiscount: { mode: 'PERCENT', percent: 0 },
    billDiscountApproval: null,
    payments: {
      cash: '10',
      card: '',
      online: '',
      cardReference: '',
      onlineReference: '',
      creditSelected: false,
    },
    ...overrides,
  };
}

function context(overrides: Partial<SaleBuildContext> = {}): SaleBuildContext {
  return {
    bill: bill(),
    products: structuredClone(PRODUCT_SEED) as Product[],
    customers: POS_CUSTOMER_SEED,
    reps: SALES_REP_SEED,
    settings: SETTINGS,
    blockExpired: true,
    today: '2026-09-21',
    now: '2026-09-21T10:30:00',
    existingSales: [],
    cashier: { id: 'usr-004', name: 'Ruwani Jayawardena' },
    ...overrides,
  };
}

function built(overrides: Partial<SaleBuildContext> = {}) {
  const result = buildSale(context(overrides));
  if (!result.ok) throw new Error(`Expected a sale, got: ${result.message}`);
  return result;
}

function refused(overrides: Partial<SaleBuildContext> = {}) {
  const result = buildSale(context(overrides));
  if (result.ok) throw new Error('Expected the sale to be refused');
  return result;
}

describe('buildSale', () => {
  describe('a good sale', () => {
    it('records lines, totals, payment, customer, cashier, date and times', () => {
      const { sale } = built();
      expect(sale.id).toBe('sale-001');
      expect(sale.invoiceNo).toBe('INV-0001');
      expect(sale.date).toBe('2026-09-21');
      expect(sale.createdAt).toBe('2026-09-21T10:30:00');
      expect(sale.cashierUserId).toBe('usr-004');
      expect(sale.customerName).toBe('Walk-in Customer');
      expect(sale.lines).toHaveSize(1);
      expect(sale.lines[0].totalCents).toBe(1000);
      expect(sale.subTotalCents).toBe(1000);
      expect(sale.totalCents).toBe(1000);
      expect(sale.paidCents).toBe(1000);
      expect(sale.changeCents).toBe(0);
      expect(sale.payments).toEqual([{ method: 'CASH', amountCents: 1000, reference: '' }]);
    });

    it('reduces stock from the earliest-expiring batch and records where it came from', () => {
      const result = built();
      const [allocation] = result.sale.lines[0].batchAllocations;
      expect(allocation.batchId).toBe('bat-001');
      expect(allocation.quantity).toBe(4);
      const product = result.products.find(item => item.id === PARACETAMOL.id)!;
      expect(product.batches.find(batch => batch.id === 'bat-001')?.quantity).toBe(1196);
      expect(product.batches.find(batch => batch.id === 'bat-002')?.quantity).toBe(2400);
    });

    it('only changes the products that were sold', () => {
      expect(built().products.map(product => product.id)).toEqual([PARACETAMOL.id]);
    });

    it('works out profit as the total less the batch cost', () => {
      expect(built().sale.profitCents).toBe(1000 - 4 * 175);
    });

    it('gives change when cash is more than the total', () => {
      const { sale } = built({
        bill: bill({ payments: { ...bill().payments, cash: '20' } }),
      });
      expect(sale.changeCents).toBe(1000);
      expect(sale.paidCents).toBe(2000);
    });

    it('records card and online references and trims them', () => {
      const { sale } = built({
        bill: bill({
          payments: {
            cash: '',
            card: '6',
            online: '4',
            cardReference: `  ${'c'.repeat(80)}  `,
            onlineReference: '',
            creditSelected: false,
          },
        }),
      });
      expect(sale.payments.map(payment => payment.method)).toEqual(['CARD', 'ONLINE']);
      expect(sale.payments[0].reference).toHaveSize(40);
      expect(sale.payments[1].reference).toBe('');
    });

    it('records the unpaid part as credit for a named customer', () => {
      const { sale } = built({
        bill: bill({
          customerId: NAMED_CUSTOMER,
          payments: { ...bill().payments, cash: '3', creditSelected: true },
        }),
      });
      expect(sale.creditCents).toBe(700);
      expect(sale.paidCents).toBe(300);
      expect(sale.payments.map(payment => payment.method)).toEqual(['CASH', 'CREDIT']);
      expect(sale.customerName).toBe('Sunil Rathnayake');
    });

    it('records the rep when one is picked', () => {
      const { sale } = built({ bill: bill({ repId: 'rep-002' }) });
      expect(sale.repId).toBe('rep-002');
      expect(sale.repName).toBe('Dilani Fernando');
      expect(built().sale.repId).toBeNull();
    });

    it('uses the bill date', () => {
      expect(built({ bill: bill({ date: '2026-09-18' }) }).sale.date).toBe('2026-09-18');
    });

    it('does not change the context it was given', () => {
      const given = context();
      const before = structuredClone(given.products);
      buildSale(given);
      expect(given.products).toEqual(before);
    });
  });

  describe('prices are not trusted from the line', () => {
    it('uses the fresh product price', () => {
      const products = structuredClone(PRODUCT_SEED) as Product[];
      products[0].priceCents = 300;
      const { sale } = built({
        products,
        bill: bill({
          lines: [line({ unitPriceCents: 1 })],
          payments: { ...bill().payments, cash: '12' },
        }),
      });
      expect(sale.lines[0].unitPriceCents).toBe(300);
      expect(sale.totalCents).toBe(1200);
    });
  });

  describe('discounts', () => {
    it('keeps an approved line discount and records its approval', () => {
      const { sale } = built({
        bill: bill({
          lines: [line({ discountPercent: 10, discountApproval: approval() })],
          payments: { ...bill().payments, cash: '9' },
        }),
      });
      expect(sale.lines[0].totalCents).toBe(900);
      expect(sale.discountApprovals).toHaveSize(1);
      expect(sale.discountApprovals[0].approverName).toBe('Nimal Perera');
    });

    it('records both the line and the bill approval', () => {
      const { sale } = built({
        bill: bill({
          lines: [line({ discountPercent: 10, discountApproval: approval() })],
          billDiscount: { mode: 'PERCENT', percent: 5 },
          billDiscountApproval: approval({ scope: 'BILL', productId: null, percent: 5 }),
          payments: { ...bill().payments, cash: '9' },
        }),
      });
      expect(sale.discountApprovals.map(item => item.scope)).toEqual(['LINE', 'BILL']);
      expect(sale.discountCents).toBe(45);
      expect(sale.totalCents).toBe(855);
    });

    it('refuses a line discount that was never approved', () => {
      const result = refused({
        bill: bill({ lines: [line({ discountPercent: 10 })] }),
      });
      expect(result.reason).toBe('invalid');
      expect(result.message).toContain('approval');
    });

    it('refuses a discount above the maximum even with an approval', () => {
      const result = refused({
        bill: bill({
          lines: [line({ discountPercent: 30, discountApproval: approval({ percent: 30 }) })],
        }),
      });
      expect(result.message).toContain('20%');
    });

    it('refuses a bill discount that was never approved', () => {
      const result = refused({ bill: bill({ billDiscount: { mode: 'PERCENT', percent: 5 } }) });
      expect(result.message).toContain('approval');
    });
  });

  describe('refusals', () => {
    it('refuses an empty bill', () => {
      expect(refused({ bill: bill({ lines: [] }) }).message).toContain('no items');
    });

    it('refuses incomplete payment', () => {
      const result = refused({ bill: bill({ payments: { ...bill().payments, cash: '5' } }) });
      expect(result.message).toContain('incomplete');
    });

    it('refuses extra card money', () => {
      const result = refused({
        bill: bill({ payments: { ...bill().payments, cash: '', card: '12' } }),
      });
      expect(result.message).toContain('Only cash');
    });

    it('refuses credit for the walk-in customer', () => {
      const result = refused({
        bill: bill({ payments: { ...bill().payments, cash: '3', creditSelected: true } }),
      });
      expect(result.message).toContain('named customer');
    });

    it('refuses payment text that is not an amount', () => {
      for (const cash of ['abc', '1.234', '-5', '1e9']) {
        const result = refused({ bill: bill({ payments: { ...bill().payments, cash } }) });
        expect(result.message).withContext(cash).toContain('payment amounts');
      }
    });

    it('refuses a customer or rep that is not on the list', () => {
      expect(refused({ bill: bill({ customerId: 'cus-999' }) }).message).toContain('customer');
      expect(refused({ bill: bill({ repId: 'rep-999' }) }).message).toContain('rep');
    });

    it('refuses a date that is not a date or is in the future', () => {
      expect(refused({ bill: bill({ date: 'tomorrow' }) }).message).toContain('date');
      expect(refused({ bill: bill({ date: '2026-09-22' }) }).message).toContain('date');
    });

    it('refuses a quantity that is not a whole number from 1', () => {
      for (const quantity of [0, -2, 1.5, Number.NaN, 1e9]) {
        const result = refused({ bill: bill({ lines: [line({ quantity })] }) });
        expect(result.message).withContext(String(quantity)).toContain('whole quantity');
      }
    });

    it('refuses the same product twice and a product that is gone', () => {
      expect(refused({ bill: bill({ lines: [line(), line()] }) }).reason).toBe('stock');
      expect(
        refused({ bill: bill({ lines: [line({ productId: 'prod-999', name: 'Ghost' })] }) }).message
      ).toContain('Ghost');
    });

    it('refuses a product that was switched off', () => {
      const products = structuredClone(PRODUCT_SEED) as Product[];
      products[0].active = false;
      expect(refused({ products }).message).toContain(PARACETAMOL.name);
    });
  });

  describe('stock that changed since the item was added', () => {
    it('blocks the sale and names the product and the amount available', () => {
      const products = structuredClone(PRODUCT_SEED) as Product[];
      for (const batch of products[0].batches) batch.quantity = 0;
      products[0].batches[0].quantity = 3;
      const result = refused({ products });
      expect(result.reason).toBe('stock');
      expect(result.message).toContain('Only 3 available for Paracetamol 500mg');
    });

    it('says out of stock when nothing is left', () => {
      const products = structuredClone(PRODUCT_SEED) as Product[];
      for (const batch of products[0].batches) batch.quantity = 0;
      expect(refused({ products }).message).toContain('out of stock');
    });

    it('says expired when only expired stock is left and expired sales are blocked', () => {
      const products = structuredClone(PRODUCT_SEED) as Product[];
      products[0].batches = [
        { id: 'old', batchNo: 'O', expiryDate: '2026-08-31', quantity: 50, costCents: 1 },
      ];
      expect(refused({ products }).message).toContain('expired');
      expect(
        built({ products, blockExpired: false }).sale.lines[0].batchAllocations[0].batchId
      ).toBe('old');
    });
  });

  describe('invoice numbers and ids', () => {
    const earlier = (invoiceNo: string, id: string) => ({ invoiceNo, id }) as Sale;

    it('keeps the bill number when it is free', () => {
      expect(built({ bill: bill({ invoiceNo: 'INV-0007' }) }).sale.invoiceNo).toBe('INV-0007');
    });

    it('gives the next number when the bill number is taken or malformed', () => {
      const existingSales = [earlier('INV-0001', 'sale-001'), earlier('INV-0002', 'sale-002')];
      expect(built({ existingSales }).sale.invoiceNo).toBe('INV-0003');
      expect(built({ existingSales, bill: bill({ invoiceNo: 'x' }) }).sale.invoiceNo).toBe(
        'INV-0003'
      );
    });

    it('gives each sale the next id', () => {
      expect(built({ existingSales: [earlier('INV-0001', 'sale-004')] }).sale.id).toBe('sale-005');
    });
  });
});
