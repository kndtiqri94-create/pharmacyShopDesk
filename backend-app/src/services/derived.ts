import { JsonObject, Tx } from '../store/types.js';

/**
 * Read models derived from stored records, ported from the app's pure utils so the numbers match:
 * pos-due.util.ts (owedCents) and pos-cash-ledger.util.ts (cash book).
 */

const num = (value: unknown): number => (typeof value === 'number' ? value : 0);
const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const list = (value: unknown): JsonObject[] => (Array.isArray(value) ? (value as JsonObject[]) : []);

export interface CustomerDue {
  customerId: string;
  name: string;
  owedCents: number;
}

/** Owed = opening due + credit sales - due payments - credit-settled returns, never below zero. */
export async function customerDues(tx: Tx): Promise<CustomerDue[]> {
  const [customers, sales, returns, payments, openings] = await Promise.all([
    tx.listEntities('posCustomers'),
    tx.listEntities('sales'),
    tx.listEntities('saleReturns'),
    tx.listEntities('duePayments'),
    tx.listEntities('openingDues'),
  ]);
  const owed = new Map<string, number>();
  const add = (customerId: string, cents: number): void => {
    owed.set(customerId, (owed.get(customerId) ?? 0) + cents);
  };
  for (const row of openings) add(str(row.data['customerId']), num(row.data['owedCents']));
  for (const row of sales) add(str(row.data['customerId']), num(row.data['creditCents']));
  for (const row of payments) add(str(row.data['customerId']), -num(row.data['amountCents']));
  for (const row of returns) {
    if (row.data['settlement'] === 'CUSTOMER_CREDIT') {
      add(str(row.data['customerId']), -num(row.data['totalCents']));
    }
  }
  const names = new Map(customers.map(row => [row.id, str(row.data['name'])]));
  return [...owed.entries()]
    .filter(([, cents]) => cents > 0)
    .map(([customerId, owedCents]) => ({
      customerId,
      name: names.get(customerId) ?? customerId,
      owedCents,
    }))
    .sort((first, second) => first.name.localeCompare(second.name));
}

export interface CashEntry {
  id: string;
  date: string;
  time: string;
  createdAt: string;
  kind: 'SALE_CASH' | 'RETURN_REFUND' | 'DUE_PAYMENT';
  direction: 'IN' | 'OUT';
  amountCents: number;
  description: string;
  refId: string;
}

export interface CashBook {
  date: string;
  openingCents: number;
  entries: CashEntry[];
  rows: { entry: CashEntry; balanceCents: number }[];
  cashInCents: number;
  cashOutCents: number;
  expectedCents: number;
}

/** Cash kept from a sale: cash received less the change handed back. */
function cashKept(sale: JsonObject): number {
  const received = list(sale['payments'])
    .filter(payment => payment['method'] === 'CASH')
    .reduce((total, payment) => total + num(payment['amountCents']), 0);
  return Math.max(0, received - num(sale['changeCents']));
}

function entry(
  base: Pick<CashEntry, 'kind' | 'direction' | 'amountCents' | 'description' | 'refId'>,
  createdAt: string
): CashEntry {
  return {
    ...base,
    id: `${base.kind}:${base.refId}`,
    date: createdAt.slice(0, 10),
    time: createdAt.slice(11, 16),
    createdAt,
  };
}

export async function cashBook(tx: Tx, date: string): Promise<CashBook> {
  const [sales, returns, payments, opening] = await Promise.all([
    tx.listEntities('sales', { dateKey: date }),
    tx.listEntities('saleReturns', { dateKey: date }),
    tx.listEntities('duePayments', { dateKey: date }),
    tx.getEntity('dayOpenings', date),
  ]);
  const entries: CashEntry[] = [];
  for (const { data } of sales) {
    const kept = cashKept(data);
    if (kept > 0 && str(data['createdAt']).slice(0, 10) === date) {
      entries.push(
        entry(
          {
            kind: 'SALE_CASH',
            direction: 'IN',
            amountCents: kept,
            description: `Sale ${str(data['invoiceNo'])}`,
            refId: str(data['id']),
          },
          str(data['createdAt'])
        )
      );
    }
  }
  for (const { data } of returns) {
    if (data['settlement'] === 'CASH_REFUND' && num(data['totalCents']) > 0) {
      entries.push(
        entry(
          {
            kind: 'RETURN_REFUND',
            direction: 'OUT',
            amountCents: num(data['totalCents']),
            description: `Refund ${str(data['returnNo'])} for ${str(data['originalInvoiceNo'])}`,
            refId: str(data['id']),
          },
          str(data['createdAt'])
        )
      );
    }
  }
  for (const { data } of payments) {
    if (data['method'] === 'CASH' && num(data['amountCents']) > 0) {
      entries.push(
        entry(
          {
            kind: 'DUE_PAYMENT',
            direction: 'IN',
            amountCents: num(data['amountCents']),
            description: `Payment ${str(data['receiptNo'])} from ${str(data['customerName'])}`,
            refId: str(data['id']),
          },
          str(data['createdAt'])
        )
      );
    }
  }
  entries.sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  const openingCents = num(opening?.data['amountCents']);
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
    date,
    openingCents,
    entries,
    rows,
    cashInCents: cashIn,
    cashOutCents: cashOut,
    expectedCents: openingCents + cashIn - cashOut,
  };
}
