import { testReturn, testSale } from '../../../testing/pos-test.util';
import { DuePayment } from '../models/domain/due-payment.model';
import { ReturnSettlement } from '../models/enums/return-settlement.enum';
import { SalePaymentMethod } from '../models/enums/sale-payment-method.enum';
import {
  cleanDueReference,
  computeDues,
  filterDues,
  isDuePaymentMethod,
  owedCents,
  parseDuePayment,
} from './pos-due.util';

const customers = [
  { id: 'cus-001', name: 'Walk-in Customer', isWalkIn: true },
  { id: 'cus-002', name: 'Sunil Rathnayake', isWalkIn: false },
  { id: 'cus-003', name: 'Anusha Wickramasinghe', isWalkIn: false },
];

const creditSale = testSale({
  id: 'sale-010',
  customerId: 'cus-002',
  customerName: 'Sunil Rathnayake',
  creditCents: 3000,
});

function payment(amountCents: number): DuePayment {
  return {
    id: 'dpay-001',
    receiptNo: 'RCP-0001',
    customerId: 'cus-002',
    customerName: 'Sunil Rathnayake',
    amountCents,
    method: SalePaymentMethod.CASH,
    reference: '',
    createdAt: '2026-09-21T12:00:00',
    takenByUserId: 'usr-004',
    takenBy: 'Ruwani Jayawardena',
  };
}

const sources = (overrides: Partial<Parameters<typeof owedCents>[1]> = {}) => ({
  sales: [creditSale],
  duePayments: [],
  returns: [],
  openingDues: [],
  ...overrides,
});

describe('pos due util', () => {
  it('owes the credit sales less payments and credit returns, never below zero', () => {
    expect(owedCents('cus-002', sources())).toBe(3000);
    expect(owedCents('cus-002', sources({ duePayments: [payment(1000)] }))).toBe(2000);
    const credit = testReturn({
      customerId: 'cus-002',
      settlement: ReturnSettlement.CUSTOMER_CREDIT,
      totalCents: 500,
    });
    expect(owedCents('cus-002', sources({ returns: [credit] }))).toBe(2500);
    expect(owedCents('cus-002', sources({ duePayments: [payment(9999)] }))).toBe(0);
  });

  it('adds a balance carried in from before the till', () => {
    const openingDues = [{ customerId: 'cus-002', owedCents: 700 }];
    expect(owedCents('cus-002', sources({ openingDues }))).toBe(3700);
  });

  it('does not take a cash refund off what a customer owes', () => {
    const refund = testReturn({ customerId: 'cus-002' });
    expect(owedCents('cus-002', sources({ returns: [refund] }))).toBe(3000);
  });

  it('lists only named customers who owe something, by name', () => {
    const dues = computeDues(customers, sources());
    expect(dues.map(due => due.name)).toEqual(['Sunil Rathnayake']);
    expect(computeDues(customers, sources({ duePayments: [payment(3000)] }))).toEqual([]);
  });

  it('searches the list by customer name', () => {
    const dues = [
      { customerId: 'a', name: 'Sunil Rathnayake', owedCents: 1 },
      { customerId: 'b', name: 'Anusha Wickramasinghe', owedCents: 1 },
    ];
    expect(filterDues(dues, 'anu')).toHaveSize(1);
    expect(filterDues(dues, '  ')).toHaveSize(2);
    expect(filterDues(dues, 'zzz')).toEqual([]);
  });

  describe('payment amount', () => {
    it('accepts an amount up to what is owed', () => {
      expect(parseDuePayment('30', 3000)).toEqual({ ok: true, cents: 3000 });
      expect(parseDuePayment('0.01', 3000)).toEqual({ ok: true, cents: 1 });
    });

    it('refuses zero, negative, blank, non numeric and more than owed', () => {
      for (const bad of ['0', '0.00', '-5', '', 'abc', 'NaN', '30.01', '1.234']) {
        expect(parseDuePayment(bad, 3000).ok).withContext(bad).toBeFalse();
      }
    });
  });

  it('knows the allowed methods and drops a reference for cash', () => {
    expect(isDuePaymentMethod('CASH')).toBeTrue();
    expect(isDuePaymentMethod('CARD')).toBeTrue();
    expect(isDuePaymentMethod('ONLINE')).toBeTrue();
    expect(isDuePaymentMethod('CREDIT')).toBeFalse();
    expect(isDuePaymentMethod('x')).toBeFalse();
    expect(cleanDueReference(SalePaymentMethod.CASH, 'abc')).toBe('');
    expect(cleanDueReference(SalePaymentMethod.CARD, '  ref1 ')).toBe('ref1');
    expect(cleanDueReference(SalePaymentMethod.CARD, 'x'.repeat(200))).toHaveSize(40);
  });
});
