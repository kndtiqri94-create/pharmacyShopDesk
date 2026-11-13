import { testReturn, testSale } from '../../../testing/pos-test.util';
import { SalePaymentMethod } from '../models/enums/sale-payment-method.enum';
import {
  CashBookLedgerInput,
  buildCashBookLedger,
  buildDailySalesSummary,
  buildPaymentInvoices,
  differenceStatus,
} from './cash-book-ledger.util';
import { ZERO_MOCK_FIGURES, mockFiguresForDay } from './cash-book-mock.util';

describe('cash-book-ledger.util', () => {
  const input = (overrides: Partial<CashBookLedgerInput> = {}): CashBookLedgerInput => ({
    openingCents: 100_000,
    cashInvoicesCents: 50_000,
    cashDuesCents: 10_000,
    cashRefundsCents: 5_000,
    adjustmentsCents: 0,
    mock: ZERO_MOCK_FIGURES,
    actualBalanceCents: null,
    ...overrides,
  });

  it('lists the thirteen rows in the specified order', () => {
    const ledger = buildCashBookLedger(input());
    expect(ledger.rows.map(row => row.description)).toEqual([
      'Opening Balance',
      'Total Expenses',
      'Advance Salary',
      'Employee Loan Settlement',
      'Incomes',
      'Invoices',
      'Previous Invoices',
      'Invoice Returns',
      'GRNs',
      'GRN Returns',
      'Cash back',
      'Adjustments',
      'Cashbook Bank Deposit',
    ]);
  });

  it('computes balance and the running balance', () => {
    const ledger = buildCashBookLedger(input());
    expect(ledger.totalCreditCents).toBe(160_000);
    expect(ledger.totalDebitCents).toBe(5_000);
    expect(ledger.balanceCents).toBe(155_000);
    expect(ledger.rows.at(-1)?.balanceCents).toBe(155_000);
    expect(ledger.rows[5].balanceCents).toBe(150_000);
  });

  it('shows zeros and no difference for an empty range', () => {
    const ledger = buildCashBookLedger(
      input({ openingCents: 0, cashInvoicesCents: 0, cashDuesCents: 0, cashRefundsCents: 0 })
    );
    expect(ledger.balanceCents).toBe(0);
    expect(ledger.actualBalanceCents).toBeNull();
    expect(ledger.differenceCents).toBeNull();
  });

  it('computes difference as actual minus balance', () => {
    expect(buildCashBookLedger(input({ actualBalanceCents: 150_000 })).differenceCents).toBe(
      -5_000
    );
    expect(buildCashBookLedger(input({ actualBalanceCents: 160_000 })).differenceCents).toBe(5_000);
    expect(differenceStatus(0)).toBe('Matches');
    expect(differenceStatus(5)).toBe('Over');
    expect(differenceStatus(-5)).toBe('Short');
  });

  it('puts a positive adjustment in credit and a negative one in debit', () => {
    const up = buildCashBookLedger(input({ adjustmentsCents: 2_500 })).rows[11];
    const down = buildCashBookLedger(input({ adjustmentsCents: -2_500 })).rows[11];
    expect([up.creditCents, up.debitCents]).toEqual([2_500, 0]);
    expect([down.creditCents, down.debitCents]).toEqual([0, 2_500]);
  });

  it('flags only the rows without a real module as sample', () => {
    const ledger = buildCashBookLedger(input({ mock: mockFiguresForDay('2026-09-21') }));
    const sample = ledger.rows.filter(row => row.isMock).map(row => row.description);
    expect(sample).toEqual([
      'Total Expenses',
      'Advance Salary',
      'Employee Loan Settlement',
      'Incomes',
      'GRNs',
      'GRN Returns',
      'Cash back',
      'Cashbook Bank Deposit',
    ]);
  });

  describe('payment and daily summaries', () => {
    const sales = [
      testSale({
        id: 's1',
        payments: [
          { method: SalePaymentMethod.CARD, amountCents: 700, reference: '1234' },
          { method: SalePaymentMethod.CASH, amountCents: 550, reference: '' },
        ],
        totalCents: 1250,
        discountCents: 50,
        changeCents: 0,
      }),
      testSale({
        id: 's2',
        payments: [{ method: SalePaymentMethod.ONLINE, amountCents: 400, reference: '' }],
        totalCents: 1000,
        creditCents: 600,
        discountCents: 0,
      }),
    ];

    it('lists Card and Online only and never counts Cash', () => {
      const lines = buildPaymentInvoices(sales);
      expect(lines.map(line => line.method)).toEqual(['Card', 'Online']);
      expect(lines[0]).toEqual({ method: 'Card', invoiceCount: 1, amountCents: 700 });
      expect(lines[1]).toEqual({ method: 'Online', invoiceCount: 1, amountCents: 400 });
    });

    it('is zero for no sales', () => {
      expect(buildPaymentInvoices([]).every(line => line.amountCents === 0)).toBeTrue();
    });

    it('builds the five daily lines', () => {
      const lines = buildDailySalesSummary(sales, [testReturn()]);
      expect(lines.map(line => line.label)).toEqual([
        'Sale Invoices',
        'Invoice Returns',
        'Discount',
        'Tax',
        'Unpaid Invoices',
      ]);
      expect(lines[0]).toEqual(jasmine.objectContaining({ count: 2, amountCents: 2250 }));
      expect(lines[1].count).toBe(1);
      expect(lines[2].amountCents).toBe(50);
      expect(lines[4]).toEqual(jasmine.objectContaining({ count: 1, amountCents: 600 }));
    });
  });
});
