import { TEST_TODAY, testReturn, testSale } from '../../../testing/pos-test.util';
import { DuePayment } from '../models/domain/due-payment.model';
import { CashEntryKind } from '../models/enums/cash-entry-kind.enum';
import { ReturnSettlement } from '../models/enums/return-settlement.enum';
import { SalePaymentMethod } from '../models/enums/sale-payment-method.enum';
import {
  buildCashEntries,
  cashKeptCents,
  computeCashBook,
  firstActivityTimestamp,
  posSalesTotalCents,
} from './pos-cash-ledger.util';

function duePayment(overrides: Partial<DuePayment> = {}): DuePayment {
  return {
    id: 'dpay-001',
    receiptNo: 'RCP-0001',
    customerId: 'cus-002',
    customerName: 'Sunil Rathnayake',
    amountCents: 1000,
    method: SalePaymentMethod.CASH,
    reference: '',
    createdAt: `${TEST_TODAY}T12:00:00`,
    takenByUserId: 'usr-004',
    takenBy: 'Ruwani Jayawardena',
    ...overrides,
  };
}

const noSources = { sales: [], returns: [], duePayments: [] };

describe('pos cash ledger util', () => {
  it('keeps the cash received less the change given', () => {
    expect(cashKeptCents(testSale())).toBe(1250);
  });

  it('counts only the cash part of a mixed payment and ignores Card, Online and Credit', () => {
    const sale = testSale({
      payments: [
        { method: SalePaymentMethod.CASH, amountCents: 500, reference: '' },
        { method: SalePaymentMethod.CARD, amountCents: 400, reference: '' },
        { method: SalePaymentMethod.ONLINE, amountCents: 200, reference: '' },
        { method: SalePaymentMethod.CREDIT, amountCents: 150, reference: '' },
      ],
      changeCents: 0,
    });
    expect(cashKeptCents(sale)).toBe(500);
    const noCash = testSale({
      payments: [{ method: SalePaymentMethod.CARD, amountCents: 1250, reference: '' }],
      changeCents: 0,
    });
    expect(cashKeptCents(noCash)).toBe(0);
    expect(buildCashEntries({ ...noSources, sales: [noCash] }, TEST_TODAY, null)).toEqual([]);
  });

  it('shows a cash refund as cash out and a cash due payment as cash in', () => {
    const entries = buildCashEntries(
      {
        sales: [testSale()],
        returns: [testReturn()],
        duePayments: [duePayment(), duePayment({ id: 'dpay-002', method: SalePaymentMethod.CARD })],
      },
      TEST_TODAY,
      null
    );
    expect(entries.map(entry => entry.kind)).toEqual([
      CashEntryKind.SALE_CASH,
      CashEntryKind.RETURN_REFUND,
      CashEntryKind.DUE_PAYMENT,
    ]);
    expect(entries.map(entry => entry.direction)).toEqual(['IN', 'OUT', 'IN']);
  });

  it('does not count a return settled as customer credit as cash out', () => {
    const entries = buildCashEntries(
      { ...noSources, returns: [testReturn({ settlement: ReturnSettlement.CUSTOMER_CREDIT })] },
      TEST_TODAY,
      null
    );
    expect(entries).toEqual([]);
  });

  it('keeps one day apart from another and stops at a cutoff', () => {
    const later = testSale({ id: 'sale-002', createdAt: `${TEST_TODAY}T15:00:00` });
    const otherDay = testSale({ id: 'sale-003', createdAt: '2026-09-20T09:00:00' });
    const sources = { ...noSources, sales: [testSale(), later, otherDay] };
    expect(buildCashEntries(sources, TEST_TODAY, null)).toHaveSize(2);
    expect(buildCashEntries(sources, TEST_TODAY, `${TEST_TODAY}T12:00:00`)).toHaveSize(1);
    expect(buildCashEntries(sources, '2026-09-20', null)).toHaveSize(1);
  });

  it('adds up a running balance from the opening balance', () => {
    const entries = buildCashEntries(
      { sales: [testSale()], returns: [testReturn()], duePayments: [duePayment()] },
      TEST_TODAY,
      null
    );
    const book = computeCashBook(5000, entries);
    expect(book.rows.map(row => row.balanceCents)).toEqual([6250, 5750, 6750]);
    expect(book.cashInCents).toBe(2250);
    expect(book.cashOutCents).toBe(500);
    expect(book.expectedCents).toBe(6750);
  });

  it('is just the opening balance on a day with no movements', () => {
    const book = computeCashBook(5000, []);
    expect(book.rows).toEqual([]);
    expect(book.expectedCents).toBe(5000);
  });

  describe('shift figures', () => {
    const early = testSale({ id: 's1', createdAt: `${TEST_TODAY}T08:15:00`, totalCents: 1000 });
    const late = testSale({ id: 's2', createdAt: `${TEST_TODAY}T15:30:00`, totalCents: 2500 });
    const otherDay = testSale({ id: 's3', createdAt: '2026-09-20T09:00:00', totalCents: 9999 });

    it('totals only the days POS sales', () => {
      expect(posSalesTotalCents({ sales: [early, late, otherDay] }, TEST_TODAY, null)).toBe(3500);
      expect(posSalesTotalCents({ sales: [] }, TEST_TODAY, null)).toBe(0);
    });

    it('leaves out sales after the close time', () => {
      expect(
        posSalesTotalCents({ sales: [early, late] }, TEST_TODAY, `${TEST_TODAY}T12:00:00`)
      ).toBe(1000);
    });

    it('starts at the first sale when there is no opening balance', () => {
      expect(firstActivityTimestamp({ sales: [late, early] }, TEST_TODAY, null)).toBe(
        early.createdAt
      );
    });

    it('starts at the opening balance when it came before the first sale', () => {
      const setAt = `${TEST_TODAY}T07:45:00`;
      expect(firstActivityTimestamp({ sales: [early] }, TEST_TODAY, { setAt })).toBe(setAt);
    });

    it('starts at the first sale when the opening balance was set later', () => {
      const setAt = `${TEST_TODAY}T09:30:00`;
      expect(firstActivityTimestamp({ sales: [early] }, TEST_TODAY, { setAt })).toBe(
        early.createdAt
      );
    });

    it('has no start time when nothing happened yet', () => {
      expect(firstActivityTimestamp({ sales: [otherDay] }, TEST_TODAY, null)).toBeNull();
    });
  });
});
