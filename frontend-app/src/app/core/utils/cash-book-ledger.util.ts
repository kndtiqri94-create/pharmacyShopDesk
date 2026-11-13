import {
  CashBookLedger,
  CashBookLedgerRow,
  CashBookRowKey,
  DailySalesLine,
  PaymentInvoiceLine,
} from '../models/domain/cash-book-ledger.model';
import { SaleReturn } from '../models/domain/sale-return.model';
import { Sale } from '../models/domain/sale.model';
import { SalePaymentMethod } from '../models/enums/sale-payment-method.enum';
import { CashBookMockFigures } from './cash-book-mock.util';

export interface CashBookLedgerInput {
  openingCents: number;
  cashInvoicesCents: number;
  cashDuesCents: number;
  cashRefundsCents: number;
  adjustmentsCents: number;
  mock: CashBookMockFigures;
  actualBalanceCents: number | null;
}

type RowDraft = Omit<CashBookLedgerRow, 'balanceCents'>;

function draft(
  key: CashBookRowKey,
  description: string,
  creditCents: number,
  debitCents: number,
  isMock = false
): RowDraft {
  return { key, description, creditCents, debitCents, isMock };
}

function rowDrafts(input: CashBookLedgerInput): RowDraft[] {
  const { mock, adjustmentsCents } = input;
  return [
    draft(CashBookRowKey.OPENING_BALANCE, 'Opening Balance', input.openingCents, 0),
    draft(CashBookRowKey.TOTAL_EXPENSES, 'Total Expenses', 0, mock.totalExpensesCents, true),
    draft(CashBookRowKey.ADVANCE_SALARY, 'Advance Salary', 0, mock.advanceSalaryCents, true),
    draft(
      CashBookRowKey.EMPLOYEE_LOAN_SETTLEMENT,
      'Employee Loan Settlement',
      mock.employeeLoanSettlementCents,
      0,
      true
    ),
    draft(CashBookRowKey.INCOMES, 'Incomes', mock.incomesCents, 0, true),
    draft(CashBookRowKey.INVOICES, 'Invoices', input.cashInvoicesCents, 0),
    draft(CashBookRowKey.PREVIOUS_INVOICES, 'Previous Invoices', input.cashDuesCents, 0),
    draft(CashBookRowKey.INVOICE_RETURNS, 'Invoice Returns', 0, input.cashRefundsCents),
    draft(CashBookRowKey.GRNS, 'GRNs', 0, mock.grnsCents, true),
    draft(CashBookRowKey.GRN_RETURNS, 'GRN Returns', mock.grnReturnsCents, 0, true),
    draft(CashBookRowKey.CASH_BACK, 'Cash back', 0, mock.cashBackCents, true),
    draft(
      CashBookRowKey.ADJUSTMENTS,
      'Adjustments',
      Math.max(0, adjustmentsCents),
      Math.max(0, -adjustmentsCents)
    ),
    draft(CashBookRowKey.BANK_DEPOSIT, 'Cashbook Bank Deposit', 0, mock.bankDepositCents, true),
  ];
}

export function buildCashBookLedger(input: CashBookLedgerInput): CashBookLedger {
  let running = 0;
  const rows = rowDrafts(input).map(item => {
    running += item.creditCents - item.debitCents;
    return { ...item, balanceCents: running };
  });
  const totalCreditCents = rows.reduce((total, row) => total + row.creditCents, 0);
  const totalDebitCents = rows.reduce((total, row) => total + row.debitCents, 0);
  const balanceCents = totalCreditCents - totalDebitCents;
  const actual = input.actualBalanceCents;
  return {
    rows,
    totalCreditCents,
    totalDebitCents,
    balanceCents,
    actualBalanceCents: actual,
    differenceCents: actual === null ? null : actual - balanceCents,
  };
}

export type DifferenceStatus = 'Matches' | 'Over' | 'Short';

export function differenceStatus(differenceCents: number): DifferenceStatus {
  if (differenceCents === 0) return 'Matches';
  return differenceCents > 0 ? 'Over' : 'Short';
}

function paidByMethod(sale: Sale, method: SalePaymentMethod): number {
  return sale.payments
    .filter(payment => payment.method === method)
    .reduce((total, payment) => total + payment.amountCents, 0);
}

function paymentLine(
  sales: readonly Sale[],
  method: SalePaymentMethod,
  label: PaymentInvoiceLine['method']
): PaymentInvoiceLine {
  const paid = sales.map(sale => paidByMethod(sale, method)).filter(amount => amount > 0);
  return {
    method: label,
    invoiceCount: paid.length,
    amountCents: paid.reduce((total, amount) => total + amount, 0),
  };
}

export function buildPaymentInvoices(sales: readonly Sale[]): PaymentInvoiceLine[] {
  return [
    paymentLine(sales, SalePaymentMethod.CARD, 'Card'),
    paymentLine(sales, SalePaymentMethod.ONLINE, 'Online'),
  ];
}

export function buildDailySalesSummary(
  sales: readonly Sale[],
  returns: readonly SaleReturn[]
): DailySalesLine[] {
  const unpaid = sales.filter(sale => sale.creditCents > 0);
  return [
    {
      key: 'SALE_INVOICES',
      label: 'Sale Invoices',
      count: sales.length,
      amountCents: sales.reduce((total, sale) => total + sale.totalCents, 0),
    },
    {
      key: 'INVOICE_RETURNS',
      label: 'Invoice Returns',
      count: returns.length,
      amountCents: returns.reduce((total, item) => total + item.totalCents, 0),
    },
    {
      key: 'DISCOUNT',
      label: 'Discount',
      count: null,
      amountCents: sales.reduce((total, sale) => total + sale.discountCents, 0),
    },
    { key: 'TAX', label: 'Tax', count: null, amountCents: 0 },
    {
      key: 'UNPAID_INVOICES',
      label: 'Unpaid Invoices',
      count: unpaid.length,
      amountCents: unpaid.reduce((total, sale) => total + sale.creditCents, 0),
    },
  ];
}
