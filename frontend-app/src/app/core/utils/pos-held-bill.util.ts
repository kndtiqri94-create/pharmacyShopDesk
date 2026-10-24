import { Bill } from '../models/domain/bill.model';
import { BillLine } from '../models/domain/bill-line.model';
import { PosCustomer } from '../models/domain/pos-customer.model';
import { PosSettings } from '../models/domain/pos-settings.model';
import { Product } from '../models/domain/product.model';
import { SalesRep } from '../models/domain/sales-rep.model';
import { cloneValue } from './clone.util';
import { formatRupeesExact } from './money.util';
import {
  defaultBillDiscount,
  defaultLineDiscountPercent,
  findDiscountProblem,
} from './pos-discount.util';
import { getSellableStock } from './pos-stock-allocation.util';
import { computeBillTotals } from './pos-totals.util';

export interface RepriceContext {
  products: readonly Product[];
  settings: PosSettings;
  customers: readonly PosCustomer[];
  reps: readonly SalesRep[];
  today: string;
  blockExpired: boolean;
}

export interface RepricedBill {
  bill: Bill;
  notes: string[];
}

function repriceLine(line: BillLine, context: RepriceContext, notes: string[]): BillLine | null {
  const product = context.products.find(candidate => candidate.id === line.productId);
  if (product === undefined || !product.active) {
    notes.push(`${line.name} is no longer for sale and was removed.`);
    return null;
  }
  const { sellableQuantity } = getSellableStock(product, context.today, context.blockExpired);
  if (sellableQuantity <= 0) {
    notes.push(`${line.name} is out of stock or expired and was removed.`);
    return null;
  }
  const next: BillLine = { ...line, unitPriceCents: product.priceCents };
  if (line.quantity > sellableQuantity) {
    next.quantity = sellableQuantity;
    notes.push(`${line.name} was reduced to ${sellableQuantity}, which is all that is available.`);
  }
  if (line.unitPriceCents !== product.priceCents) {
    notes.push(`The price of ${line.name} is now ${formatRupeesExact(product.priceCents)}.`);
  }
  const problem = findDiscountProblem(
    [next],
    defaultBillDiscount(context.settings),
    null,
    0,
    context.settings
  );
  if (problem !== null) {
    next.discountPercent = defaultLineDiscountPercent(context.settings);
    next.discountApproval = null;
    notes.push(`The discount on ${line.name} was reset to the default.`);
  }
  return next;
}

export function repriceHeldBill(stored: Bill, context: RepriceContext): RepricedBill {
  const bill = cloneValue(stored);
  const notes: string[] = [];
  bill.lines = bill.lines
    .map(line => repriceLine(line, context, notes))
    .filter((line): line is BillLine => line !== null);
  const totals = computeBillTotals(bill.lines, bill.billDiscount, {
    cashCents: 0,
    cardCents: 0,
    onlineCents: 0,
    creditSelected: false,
  });
  const billProblem = findDiscountProblem(
    [],
    bill.billDiscount,
    bill.billDiscountApproval,
    totals.subTotalCents,
    context.settings
  );
  if (billProblem !== null) {
    bill.billDiscount = defaultBillDiscount(context.settings);
    bill.billDiscountApproval = null;
    notes.push('The bill discount was reset to the default.');
  }
  if (!context.customers.some(customer => customer.id === bill.customerId)) {
    bill.customerId = context.customers.find(customer => customer.isWalkIn)?.id ?? '';
  }
  if (bill.repId !== null && !context.reps.some(rep => rep.id === bill.repId)) bill.repId = null;
  if (bill.date > context.today) bill.date = context.today;
  return { bill, notes };
}
