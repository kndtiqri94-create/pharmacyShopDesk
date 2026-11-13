export const CashBookRowKey = {
  OPENING_BALANCE: 'OPENING_BALANCE',
  TOTAL_EXPENSES: 'TOTAL_EXPENSES',
  ADVANCE_SALARY: 'ADVANCE_SALARY',
  EMPLOYEE_LOAN_SETTLEMENT: 'EMPLOYEE_LOAN_SETTLEMENT',
  INCOMES: 'INCOMES',
  INVOICES: 'INVOICES',
  PREVIOUS_INVOICES: 'PREVIOUS_INVOICES',
  INVOICE_RETURNS: 'INVOICE_RETURNS',
  GRNS: 'GRNS',
  GRN_RETURNS: 'GRN_RETURNS',
  CASH_BACK: 'CASH_BACK',
  ADJUSTMENTS: 'ADJUSTMENTS',
  BANK_DEPOSIT: 'BANK_DEPOSIT',
} as const;

export type CashBookRowKey = (typeof CashBookRowKey)[keyof typeof CashBookRowKey];

export interface CashBookLedgerRow {
  key: CashBookRowKey;
  description: string;
  creditCents: number;
  debitCents: number;
  balanceCents: number;
  isMock: boolean;
}

export interface CashBookLedger {
  rows: CashBookLedgerRow[];
  totalCreditCents: number;
  totalDebitCents: number;
  balanceCents: number;
  actualBalanceCents: number | null;
  differenceCents: number | null;
}

export interface PaymentInvoiceLine {
  method: 'Card' | 'Online';
  invoiceCount: number;
  amountCents: number;
}

export interface DailySalesLine {
  key: 'SALE_INVOICES' | 'INVOICE_RETURNS' | 'DISCOUNT' | 'TAX' | 'UNPAID_INVOICES';
  label: string;
  count: number | null;
  amountCents: number;
}

export interface CashBookReport {
  from: string;
  to: string;
  ledger: CashBookLedger;
  paymentInvoices: PaymentInvoiceLine[];
  dailySales: DailySalesLine[];
  toDayLocked: boolean;
}
