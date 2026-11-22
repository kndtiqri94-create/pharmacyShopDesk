import { CashEntry } from '../models/domain/cash-entry.model';
import { DayOpening } from '../models/domain/day-opening.model';
import { DuePayment } from '../models/domain/due-payment.model';
import { SaleReturn } from '../models/domain/sale-return.model';
import { Sale } from '../models/domain/sale.model';
import { CashEntryKind } from '../models/enums/cash-entry-kind.enum';
import { ReturnSettlement } from '../models/enums/return-settlement.enum';
import { SalePaymentMethod } from '../models/enums/sale-payment-method.enum';
import { formatTime } from './date.util';

export interface CashLedgerSources {
  sales: readonly Sale[];
  returns: readonly SaleReturn[];
  duePayments: readonly DuePayment[];
}

export interface CashBookRow {
  entry: CashEntry;
  balanceCents: number;
}

export interface CashBook {
  openingCents: number;
  entries: CashEntry[];
  rows: CashBookRow[];
  cashInCents: number;
  cashOutCents: number;
  expectedCents: number;
}

export function dateOfTimestamp(timestamp: string): string {
  return timestamp.slice(0, 10);
}

/**
 * Cash kept from a sale is the cash received less the change handed back. Card, Online and Credit
 * payments never reach the drawer, and Reload and Utility sales are never read here.
 */
export function cashKeptCents(sale: Sale): number {
  const received = sale.payments
    .filter(payment => payment.method === SalePaymentMethod.CASH)
    .reduce((total, payment) => total + payment.amountCents, 0);
  return Math.max(0, received - sale.changeCents);
}

function entry(
  base: Pick<CashEntry, 'kind' | 'direction' | 'amountCents' | 'description' | 'refId'>,
  createdAt: string
): CashEntry {
  return {
    ...base,
    id: `${base.kind}:${base.refId}`,
    date: dateOfTimestamp(createdAt),
    time: formatTime(createdAt),
    createdAt,
  };
}

function saleEntries(sales: readonly Sale[]): CashEntry[] {
  return sales
    .filter(sale => cashKeptCents(sale) > 0)
    .map(sale =>
      entry(
        {
          kind: CashEntryKind.SALE_CASH,
          direction: 'IN',
          amountCents: cashKeptCents(sale),
          description: `Sale ${sale.invoiceNo}`,
          refId: sale.id,
        },
        sale.createdAt
      )
    );
}

function refundEntries(returns: readonly SaleReturn[]): CashEntry[] {
  return returns
    .filter(item => item.settlement === ReturnSettlement.CASH_REFUND && item.totalCents > 0)
    .map(item =>
      entry(
        {
          kind: CashEntryKind.RETURN_REFUND,
          direction: 'OUT',
          amountCents: item.totalCents,
          description: `Refund ${item.returnNo} for ${item.originalInvoiceNo}`,
          refId: item.id,
        },
        item.createdAt
      )
    );
}

function dueEntries(payments: readonly DuePayment[]): CashEntry[] {
  return payments
    .filter(payment => payment.method === SalePaymentMethod.CASH && payment.amountCents > 0)
    .map(payment =>
      entry(
        {
          kind: CashEntryKind.DUE_PAYMENT,
          direction: 'IN',
          amountCents: payment.amountCents,
          description: `Payment ${payment.receiptNo} from ${payment.customerName}`,
          refId: payment.id,
        },
        payment.createdAt
      )
    );
}

export function buildCashEntries(
  sources: CashLedgerSources,
  date: string,
  cutoff: string | null
): CashEntry[] {
  const all = [
    ...saleEntries(sources.sales),
    ...refundEntries(sources.returns),
    ...dueEntries(sources.duePayments),
  ];
  return all
    .filter(item => item.date === date && (cutoff === null || item.createdAt <= cutoff))
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt));
}

export function computeCashBook(openingCents: number, entries: readonly CashEntry[]): CashBook {
  let balance = openingCents;
  let cashIn = 0;
  let cashOut = 0;
  const rows = entries.map(item => {
    if (item.direction === 'IN') {
      balance += item.amountCents;
      cashIn += item.amountCents;
    } else {
      balance -= item.amountCents;
      cashOut += item.amountCents;
    }
    return { entry: item, balanceCents: balance };
  });
  return {
    openingCents,
    entries: [...entries],
    rows,
    cashInCents: cashIn,
    cashOutCents: cashOut,
    expectedCents: openingCents + cashIn - cashOut,
  };
}

function posSalesOnDay(sales: readonly Sale[], date: string, cutoff: string | null): Sale[] {
  return sales.filter(
    sale =>
      dateOfTimestamp(sale.createdAt) === date && (cutoff === null || sale.createdAt <= cutoff)
  );
}

/**
 * Total of the day's POS sale totals up to the cutoff. Reload and Utility sales are never read
 * here, so they are never part of Total Sales or the Sales Breakdown.
 */
export function posSalesTotalCents(
  records: Pick<CashLedgerSources, 'sales'>,
  date: string,
  cutoff: string | null
): number {
  return posSalesOnDay(records.sales, date, cutoff).reduce(
    (total, sale) => total + sale.totalCents,
    0
  );
}

/** The earlier of the first POS sale of the day and the moment the opening balance was set. */
export function firstActivityTimestamp(
  records: Pick<CashLedgerSources, 'sales'>,
  date: string,
  opening: Pick<DayOpening, 'setAt'> | null
): string | null {
  const stamps = posSalesOnDay(records.sales, date, null).map(sale => sale.createdAt);
  if (opening !== null && dateOfTimestamp(opening.setAt) === date) stamps.push(opening.setAt);
  if (stamps.length === 0) return null;
  stamps.sort((first, second) => first.localeCompare(second));
  return stamps[0];
}

export function sumCashEntries(entries: readonly CashEntry[], kind: CashEntryKind): number {
  return entries
    .filter(item => item.kind === kind)
    .reduce((total, item) => total + item.amountCents, 0);
}

export function hasDayActivity(
  sources: CashLedgerSources,
  date: string,
  hasOpening: boolean
): boolean {
  return (
    hasOpening ||
    sources.sales.some(sale => dateOfTimestamp(sale.createdAt) === date) ||
    sources.returns.some(item => dateOfTimestamp(item.createdAt) === date) ||
    sources.duePayments.some(payment => dateOfTimestamp(payment.createdAt) === date)
  );
}
