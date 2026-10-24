import { Bill } from '../models/domain/bill.model';
import { BillLine } from '../models/domain/bill-line.model';
import { DiscountApproval } from '../models/domain/discount-approval.model';
import { PosCustomer } from '../models/domain/pos-customer.model';
import { PosSettings } from '../models/domain/pos-settings.model';
import { Product } from '../models/domain/product.model';
import { SaleLine } from '../models/domain/sale-line.model';
import { SalePayment } from '../models/domain/sale-payment.model';
import { Sale } from '../models/domain/sale.model';
import { SalesRep } from '../models/domain/sales-rep.model';
import { SalePaymentMethod } from '../models/enums/sale-payment-method.enum';
import { cloneValue } from './clone.util';
import { isIsoDate } from './date.util';
import { isInvoiceNumber, nextInvoiceNumber } from './invoice-number.util';
import { nextRecordId } from './document-number.util';
import {
  defaultBillDiscount,
  defaultLineDiscountPercent,
  findDiscountProblem,
  samePercent,
} from './pos-discount.util';
import { allocateStock, getSellableStock } from './pos-stock-allocation.util';
import {
  BillTotals,
  billDiscountPercent,
  computeBillTotals,
  lineTotalCents,
} from './pos-totals.util';
import {
  MAX_BILL_LINES,
  REFERENCE_MAX_LENGTH,
  invalidQuantityMessage,
  parseLineQuantity,
  parsePaymentEntries,
  stockLimitMessage,
  validateSaleReadiness,
} from './pos-validation.util';

export interface SaleBuildContext {
  bill: Bill;
  products: readonly Product[];
  customers: readonly PosCustomer[];
  reps: readonly SalesRep[];
  settings: PosSettings;
  blockExpired: boolean;
  today: string;
  now: string;
  existingSales: readonly Sale[];
  cashier: { id: string; name: string };
}

export type SaleBuildFailure = 'invalid' | 'stock';

export type SaleBuildResult =
  | { ok: true; sale: Sale; products: Product[] }
  | { ok: false; reason: SaleBuildFailure; message: string };

const BAD_PAYMENT = 'Check the payment amounts. Use numbers like 100 or 100.50.';

function invalid(message: string): SaleBuildResult {
  return { ok: false, reason: 'invalid', message };
}

type PricedResult = { lines: BillLine[] } | { failure: SaleBuildResult };

function lineShapeProblem(line: BillLine): string | null {
  if (parseLineQuantity(String(line.quantity)) === null) return invalidQuantityMessage();
  const percent = line.discountPercent;
  const validPercent = Number.isFinite(percent) && percent >= 0 && percent <= 100;
  return validPercent ? null : `The discount on ${line.name} is not valid.`;
}

function pricedLines(bill: Bill, products: readonly Product[]): PricedResult {
  const seen = new Set<string>();
  const lines: BillLine[] = [];
  for (const line of bill.lines) {
    const shapeProblem = lineShapeProblem(line);
    if (shapeProblem !== null) return { failure: invalid(shapeProblem) };
    const product = products.find(candidate => candidate.id === line.productId);
    if (product === undefined || !product.active || seen.has(line.productId)) {
      const message = `${line.name} is no longer available. Remove it and try again.`;
      return { failure: { ok: false, reason: 'stock', message } };
    }
    seen.add(line.productId);
    lines.push({ ...line, unitPriceCents: product.priceCents });
  }
  return { lines };
}

function checkReferences(
  bill: Bill,
  customers: readonly PosCustomer[],
  reps: readonly SalesRep[],
  today: string
): string | null {
  if (!customers.some(customer => customer.id === bill.customerId)) {
    return 'Choose a customer from the list.';
  }
  if (bill.repId !== null && !reps.some(rep => rep.id === bill.repId)) {
    return 'Choose a rep from the list, or leave it empty.';
  }
  if (!isIsoDate(bill.date) || bill.date > today) {
    return 'Choose today or an earlier date for the bill.';
  }
  return null;
}

function buildSaleLines(
  lines: readonly BillLine[],
  products: readonly Product[],
  context: SaleBuildContext
): { saleLines: SaleLine[]; products: Product[] } | { message: string } {
  const working = new Map(products.map(product => [product.id, product]));
  const changed = new Map<string, Product>();
  const saleLines: SaleLine[] = [];
  for (const line of lines) {
    const quantity = parseLineQuantity(String(line.quantity));
    if (quantity === null) return { message: invalidQuantityMessage() };
    const product = working.get(line.productId)!;
    const stock = getSellableStock(product, context.today, context.blockExpired);
    if (stock.totalQuantity <= 0) return { message: `${product.name} is out of stock.` };
    if (stock.sellableQuantity <= 0)
      return { message: `${product.name} is expired and cannot be sold.` };
    const allocation = allocateStock(product, quantity, context.today, context.blockExpired);
    if (!allocation.ok) {
      const limit = stockLimitMessage(product.name, allocation.availableQuantity);
      return { message: `${limit} Change the quantity and save again.` };
    }
    working.set(product.id, allocation.product);
    changed.set(product.id, allocation.product);
    saleLines.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      barcode: product.barcode,
      unitPriceCents: line.unitPriceCents,
      discountPercent: line.discountPercent,
      quantity,
      totalCents: lineTotalCents({ ...line, quantity }),
      batchAllocations: allocation.allocations,
    });
  }
  return { saleLines, products: Array.from(changed.values()) };
}

function buildPayments(bill: Bill, totals: BillTotals, cash: number, card: number, online: number) {
  const payments: SalePayment[] = [];
  const reference = (text: string) => text.trim().slice(0, REFERENCE_MAX_LENGTH);
  if (cash > 0) payments.push({ method: SalePaymentMethod.CASH, amountCents: cash, reference: '' });
  if (card > 0) {
    payments.push({
      method: SalePaymentMethod.CARD,
      amountCents: card,
      reference: reference(bill.payments.cardReference),
    });
  }
  if (online > 0) {
    payments.push({
      method: SalePaymentMethod.ONLINE,
      amountCents: online,
      reference: reference(bill.payments.onlineReference),
    });
  }
  if (totals.creditCents > 0) {
    payments.push({
      method: SalePaymentMethod.CREDIT,
      amountCents: totals.creditCents,
      reference: '',
    });
  }
  return payments;
}

function collectApprovals(
  lines: readonly BillLine[],
  bill: Bill,
  totals: BillTotals,
  settings: PosSettings
): DiscountApproval[] {
  const approvals: DiscountApproval[] = [];
  const lineDefault = defaultLineDiscountPercent(settings);
  for (const line of lines) {
    if (line.discountApproval !== null && !samePercent(line.discountPercent, lineDefault)) {
      approvals.push({ ...line.discountApproval });
    }
  }
  const billDefault = billDiscountPercent(totals.subTotalCents, defaultBillDiscount(settings));
  const billPercent = billDiscountPercent(totals.subTotalCents, bill.billDiscount);
  if (bill.billDiscountApproval !== null && !samePercent(billPercent, billDefault)) {
    approvals.push({ ...bill.billDiscountApproval });
  }
  return approvals;
}

function costOf(saleLines: readonly SaleLine[]): number {
  return saleLines.reduce(
    (total, line) =>
      total + line.batchAllocations.reduce((sum, item) => sum + item.quantity * item.costCents, 0),
    0
  );
}

function resolveInvoiceNumber(bill: Bill, sales: readonly Sale[]): string {
  const used = sales.map(sale => sale.invoiceNo);
  return isInvoiceNumber(bill.invoiceNo) && !used.includes(bill.invoiceNo)
    ? bill.invoiceNo
    : nextInvoiceNumber(used);
}

export function buildSale(context: SaleBuildContext): SaleBuildResult {
  const { bill, settings } = context;
  if (bill.lines.length > MAX_BILL_LINES) return invalid('The bill has too many items.');
  const referenceProblem = checkReferences(bill, context.customers, context.reps, context.today);
  if (referenceProblem !== null) return invalid(referenceProblem);
  const parsed = parsePaymentEntries(bill.payments);
  if (parsed.amounts === null) return invalid(BAD_PAYMENT);
  const pricing = pricedLines(bill, context.products);
  if ('failure' in pricing) return pricing.failure;
  const priced = pricing.lines;
  const totals = computeBillTotals(priced, bill.billDiscount, parsed.amounts);
  const customer = context.customers.find(candidate => candidate.id === bill.customerId)!;
  const problem = findDiscountProblem(
    priced,
    bill.billDiscount,
    bill.billDiscountApproval,
    totals.subTotalCents,
    settings
  );
  if (problem !== null) return invalid(problem);
  const readiness = validateSaleReadiness({
    lineCount: priced.length,
    totals,
    amounts: parsed.amounts,
    isWalkIn: customer.isWalkIn,
  });
  if (readiness !== null) return invalid(readiness.message);
  const built = buildSaleLines(priced, context.products, context);
  if ('message' in built) return { ok: false, reason: 'stock', message: built.message };
  const rep = bill.repId === null ? null : context.reps.find(item => item.id === bill.repId)!;
  const sale: Sale = {
    id: nextRecordId(
      'sale',
      context.existingSales.map(existing => existing.id)
    ),
    invoiceNo: resolveInvoiceNumber(bill, context.existingSales),
    date: bill.date,
    createdAt: context.now,
    cashierUserId: context.cashier.id,
    cashierName: context.cashier.name,
    customerId: customer.id,
    customerName: customer.name,
    repId: rep?.id ?? null,
    repName: rep?.name ?? null,
    lines: built.saleLines,
    payments: buildPayments(
      bill,
      totals,
      parsed.amounts.cashCents,
      parsed.amounts.cardCents,
      parsed.amounts.onlineCents
    ),
    subTotalCents: totals.subTotalCents,
    discountCents: totals.discountCents,
    totalCents: totals.totalCents,
    paidCents: totals.paidCents,
    creditCents: totals.creditCents,
    changeCents: totals.changeCents,
    profitCents: totals.totalCents - costOf(built.saleLines),
    discountApprovals: collectApprovals(priced, bill, totals, settings),
  };
  return { ok: true, sale: cloneValue(sale), products: built.products };
}
