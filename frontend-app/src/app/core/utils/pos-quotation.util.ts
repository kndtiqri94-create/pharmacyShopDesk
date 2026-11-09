import { BillLine } from '../models/domain/bill-line.model';
import { Bill } from '../models/domain/bill.model';
import { PosCustomer } from '../models/domain/pos-customer.model';
import { PosSettings } from '../models/domain/pos-settings.model';
import { Product } from '../models/domain/product.model';
import { SalesRep } from '../models/domain/sales-rep.model';
import { cloneValue } from './clone.util';
import { formatRupeesExact } from './money.util';
import { defaultBillDiscount, defaultLineDiscountPercent, samePercent } from './pos-discount.util';
import { emptyPaymentEntries } from './pos-payment-entries.util';
import { getSellableStock } from './pos-stock-allocation.util';
import { billDiscountPercent, computeBillTotals } from './pos-totals.util';
import { checkProductAddable } from './pos-validation.util';

export const MAX_QUOTATIONS = 200;
export const QUOTATION_NOT_FOUND = 'That quotation is no longer there.';
export const QUOTATION_ALREADY_CONVERTED = 'That quotation was already converted to an invoice.';

export interface QuotationConversionContext {
  products: readonly Product[];
  customers: readonly PosCustomer[];
  reps: readonly SalesRep[];
  settings: PosSettings;
  today: string;
  blockExpired: boolean;
  invoiceNo: string;
}

export interface QuotationConversion {
  bill: Bill;
  notes: string[];
  needsApproval: boolean;
}

export function snapshotQuotationBill(bill: Bill): Bill {
  const copy = cloneValue(bill);
  return {
    ...copy,
    invoiceNo: '',
    payments: emptyPaymentEntries(),
  };
}

export function quotationTotalCents(bill: Bill): number {
  return computeBillTotals(bill.lines, bill.billDiscount, {
    cashCents: 0,
    cardCents: 0,
    onlineCents: 0,
    creditSelected: false,
  }).totalCents;
}

function reviewLine(
  line: BillLine,
  context: QuotationConversionContext,
  notes: string[]
): BillLine {
  const product = context.products.find(candidate => candidate.id === line.productId);
  if (product === undefined || !product.active) {
    notes.push(`${line.name} is no longer for sale. Remove it before saving.`);
    return { ...line, discountApproval: null };
  }
  if (line.unitPriceCents !== product.priceCents) {
    notes.push(`The price of ${line.name} is now ${formatRupeesExact(product.priceCents)}.`);
  }
  const stock = getSellableStock(product, context.today, context.blockExpired);
  const check = checkProductAddable(product, stock, 0, line.quantity - 1);
  if (!check.ok) notes.push(`${check.message} Change the quantity or remove it.`);
  return { ...line, unitPriceCents: product.priceCents, discountApproval: null };
}

export function prepareQuotationForInvoice(
  stored: Bill,
  context: QuotationConversionContext
): QuotationConversion {
  const bill = cloneValue(stored);
  const notes: string[] = [];
  bill.lines = bill.lines.map(line => reviewLine(line, context, notes));
  bill.invoiceNo = context.invoiceNo;
  bill.date = context.today;
  bill.billDiscountApproval = null;
  if (!context.customers.some(customer => customer.id === bill.customerId)) {
    bill.customerId = context.customers.find(customer => customer.isWalkIn)?.id ?? '';
  }
  if (bill.repId !== null && !context.reps.some(rep => rep.id === bill.repId)) bill.repId = null;
  const lineDefault = defaultLineDiscountPercent(context.settings);
  const subTotal = computeBillTotals(bill.lines, bill.billDiscount, {
    cashCents: 0,
    cardCents: 0,
    onlineCents: 0,
    creditSelected: false,
  }).subTotalCents;
  const billDefault = billDiscountPercent(subTotal, defaultBillDiscount(context.settings));
  const billNow = billDiscountPercent(subTotal, bill.billDiscount);
  const needsApproval =
    bill.lines.some(line => !samePercent(line.discountPercent, lineDefault)) ||
    !samePercent(billNow, billDefault);
  if (needsApproval) {
    notes.push('A discount on this quotation needs an Admin approval again before you can save.');
  }
  return { bill, notes, needsApproval };
}
