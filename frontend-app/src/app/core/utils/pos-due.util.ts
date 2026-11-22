import { CustomerDue } from '../models/domain/customer-due.model';
import { DuePayment } from '../models/domain/due-payment.model';
import { PosCustomer } from '../models/domain/pos-customer.model';
import { SaleReturn } from '../models/domain/sale-return.model';
import { Sale } from '../models/domain/sale.model';
import { ReturnSettlement } from '../models/enums/return-settlement.enum';
import { SalePaymentMethod } from '../models/enums/sale-payment-method.enum';
import { formatRupeesExact } from './money.util';
import { SEARCH_TEXT_MAX_LENGTH } from './pos-search.util';
import { REFERENCE_MAX_LENGTH, parseRequiredAmountCents } from './pos-validation.util';

export const DUE_PAYMENT_METHODS: readonly SalePaymentMethod[] = [
  SalePaymentMethod.CASH,
  SalePaymentMethod.CARD,
  SalePaymentMethod.ONLINE,
];

export const DUE_AMOUNT_ERROR_MESSAGE = 'Enter the amount like 500 or 500.50, more than zero.';

export interface DueSources {
  sales: readonly Sale[];
  duePayments: readonly DuePayment[];
  returns: readonly SaleReturn[];
  openingDues: readonly { customerId: string; owedCents: number }[];
}

export type DuePaymentParse = { ok: true; cents: number } | { ok: false; message: string };

/**
 * What a customer owes is their Credit sales (plus any balance carried in from before the till) less payments taken on dues and less returns settled
 * as customer credit. It is derived each time, never stored, and never below zero.
 */
export function owedCents(customerId: string, sources: DueSources): number {
  const opening = sources.openingDues
    .filter(due => due.customerId === customerId)
    .reduce((total, due) => total + due.owedCents, 0);
  const credit = sources.sales
    .filter(sale => sale.customerId === customerId)
    .reduce((total, sale) => total + sale.creditCents, 0);
  const paid = sources.duePayments
    .filter(payment => payment.customerId === customerId)
    .reduce((total, payment) => total + payment.amountCents, 0);
  const credited = sources.returns
    .filter(
      item => item.customerId === customerId && item.settlement === ReturnSettlement.CUSTOMER_CREDIT
    )
    .reduce((total, item) => total + item.totalCents, 0);
  return Math.max(0, opening + credit - paid - credited);
}

export function computeDues(customers: readonly PosCustomer[], sources: DueSources): CustomerDue[] {
  return customers
    .filter(customer => !customer.isWalkIn)
    .map(customer => ({
      customerId: customer.id,
      name: customer.name,
      owedCents: owedCents(customer.id, sources),
    }))
    .filter(due => due.owedCents > 0)
    .sort((first, second) => first.name.localeCompare(second.name));
}

export function filterDues(dues: readonly CustomerDue[], text: string): CustomerDue[] {
  const term = text.trim().slice(0, SEARCH_TEXT_MAX_LENGTH).toLowerCase();
  return term.length === 0 ? [...dues] : dues.filter(due => due.name.toLowerCase().includes(term));
}

export function isDuePaymentMethod(method: string): method is SalePaymentMethod {
  return DUE_PAYMENT_METHODS.includes(method as SalePaymentMethod);
}

export function parseDuePayment(text: string, owed: number): DuePaymentParse {
  const cents = parseRequiredAmountCents(text);
  if (cents === null || cents <= 0) return { ok: false, message: DUE_AMOUNT_ERROR_MESSAGE };
  if (cents > owed) {
    return {
      ok: false,
      message: `The amount cannot be more than ${formatRupeesExact(owed)} owed.`,
    };
  }
  return { ok: true, cents };
}

export function cleanDueReference(method: SalePaymentMethod, text: string): string {
  return method === SalePaymentMethod.CASH ? '' : text.trim().slice(0, REFERENCE_MAX_LENGTH);
}
