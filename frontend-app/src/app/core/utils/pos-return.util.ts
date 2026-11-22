import { PosCustomer } from '../models/domain/pos-customer.model';
import { Product } from '../models/domain/product.model';
import { SaleLine } from '../models/domain/sale-line.model';
import { Sale } from '../models/domain/sale.model';
import { ReturnAllocation, SaleReturn, SaleReturnLine } from '../models/domain/sale-return.model';
import { ReturnSettlement } from '../models/enums/return-settlement.enum';
import { cloneValue } from './clone.util';
import { nextDocumentNumber, nextRecordId } from './document-number.util';
import { divideRoundHalfUp, formatCount } from './money.util';
import { restockReturnLine } from './pos-return-restock.util';
import { MAX_LINE_QUANTITY } from './pos-validation.util';
import { parseNonNegativeNumber } from './product-validation.util';

export const LOOKUP_TEXT_MAX_LENGTH = 20;
export const NOTHING_SELECTED_MESSAGE = 'Nothing is selected to return. Enter a quantity first.';
export const WALK_IN_CREDIT_MESSAGE =
  'Walk-in Customer gets a cash refund only. Credit needs a named customer.';

export interface ReturnableLine {
  productId: string;
  sku: string;
  name: string;
  soldQuantity: number;
  returnedQuantity: number;
  returnableQuantity: number;
  unitPriceCents: number;
  effectiveTotalCents: number;
  saleLine: SaleLine;
}

export type QuantityParse = { ok: true; quantity: number } | { ok: false; message: string };

export interface ReturnBuildContext {
  sale: Sale;
  allReturns: readonly SaleReturn[];
  products: readonly Product[];
  customers: readonly PosCustomer[];
  quantities: Readonly<Record<string, string>>;
  settlement: ReturnSettlement;
  blockExpired: boolean;
  today: string;
  now: string;
  processedBy: { id: string; name: string };
}

export type ReturnBuildResult =
  | { ok: true; saleReturn: SaleReturn; products: Product[] }
  | { ok: false; reason: 'invalid' | 'stock'; message: string };

export interface ReturnPick {
  line: ReturnableLine;
  quantity: number;
  valueCents: number;
}

export interface ReturnSelection {
  picks: ReturnPick[];
  totalCents: number;
  errors: Record<string, string>;
}

export function normaliseLookup(text: string): string {
  return text.trim().slice(0, LOOKUP_TEXT_MAX_LENGTH).toUpperCase();
}

function returnLinesFor(
  returns: readonly SaleReturn[],
  saleId: string,
  productId: string
): SaleReturnLine[] {
  return returns
    .filter(candidate => candidate.originalSaleId === saleId)
    .flatMap(candidate => candidate.lines)
    .filter(line => line.productId === productId);
}

export function returnedQuantity(
  returns: readonly SaleReturn[],
  saleId: string,
  productId: string
): number {
  return returnLinesFor(returns, saleId, productId).reduce(
    (total, line) => total + line.quantity,
    0
  );
}

export function totalReturnedCents(returns: readonly SaleReturn[], saleId: string): number {
  return returns
    .filter(candidate => candidate.originalSaleId === saleId)
    .reduce((total, candidate) => total + candidate.totalCents, 0);
}

/**
 * The price actually charged for a line is its line total less its proportional share of the bill
 * discount, rounded half up. Partial returns are valued as the difference of two cumulative values
 * so that returning a line in pieces never adds up to more than the line was worth.
 */
export function effectiveLineTotalCents(sale: Sale, line: SaleLine): number {
  const share =
    sale.subTotalCents > 0 && sale.discountCents > 0
      ? divideRoundHalfUp(sale.discountCents * line.totalCents, sale.subTotalCents)
      : 0;
  return Math.max(0, line.totalCents - share);
}

function valueOfFirst(effectiveTotalCents: number, soldQuantity: number, quantity: number): number {
  return divideRoundHalfUp(effectiveTotalCents * quantity, soldQuantity);
}

export function returnValueCents(line: ReturnableLine, quantity: number): number {
  const before = valueOfFirst(line.effectiveTotalCents, line.soldQuantity, line.returnedQuantity);
  const after = valueOfFirst(
    line.effectiveTotalCents,
    line.soldQuantity,
    line.returnedQuantity + quantity
  );
  return after - before;
}

export function buildReturnableLines(sale: Sale, returns: readonly SaleReturn[]): ReturnableLine[] {
  return sale.lines.map(saleLine => {
    const already = returnedQuantity(returns, sale.id, saleLine.productId);
    const effective = effectiveLineTotalCents(sale, saleLine);
    return {
      productId: saleLine.productId,
      sku: saleLine.sku,
      name: saleLine.name,
      soldQuantity: saleLine.quantity,
      returnedQuantity: already,
      returnableQuantity: Math.max(0, saleLine.quantity - already),
      unitPriceCents: divideRoundHalfUp(effective, saleLine.quantity),
      effectiveTotalCents: effective,
      saleLine,
    };
  });
}

export function parseReturnQuantity(text: string, line: ReturnableLine): QuantityParse {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: true, quantity: 0 };
  const quantity = parseNonNegativeNumber(trimmed, 0);
  if (quantity === null || quantity > MAX_LINE_QUANTITY) {
    return { ok: false, message: `Enter a whole quantity for ${line.name}.` };
  }
  if (quantity > line.returnableQuantity) {
    const remaining = formatCount(line.returnableQuantity);
    return { ok: false, message: `Only ${remaining} of ${line.name} remain returnable.` };
  }
  return { ok: true, quantity };
}

export function settlementOptions(isWalkIn: boolean): ReturnSettlement[] {
  return isWalkIn
    ? [ReturnSettlement.CASH_REFUND]
    : [ReturnSettlement.CASH_REFUND, ReturnSettlement.CUSTOMER_CREDIT];
}

export function selectReturn(
  lines: readonly ReturnableLine[],
  quantities: Readonly<Record<string, string>>
): ReturnSelection {
  const picks: ReturnPick[] = [];
  const errors: Record<string, string> = {};
  for (const line of lines) {
    const parsed = parseReturnQuantity(quantities[line.productId] ?? '', line);
    if (!parsed.ok) {
      errors[line.productId] = parsed.message;
    } else if (parsed.quantity > 0) {
      picks.push({
        line,
        quantity: parsed.quantity,
        valueCents: returnValueCents(line, parsed.quantity),
      });
    }
  }
  const totalCents = picks.reduce((total, pick) => total + pick.valueCents, 0);
  return { picks, totalCents, errors };
}

function priorAllocations(
  returns: readonly SaleReturn[],
  saleId: string,
  productId: string
): ReturnAllocation[] {
  return returnLinesFor(returns, saleId, productId).flatMap(line => line.restockAllocations);
}

function invalid(message: string): ReturnBuildResult {
  return { ok: false, reason: 'invalid', message };
}

function checkSettlement(
  customer: PosCustomer | undefined,
  settlement: ReturnSettlement
): string | null {
  if (customer === undefined) return 'That customer is no longer on file.';
  const credit = settlement === ReturnSettlement.CUSTOMER_CREDIT;
  return credit && customer.isWalkIn ? WALK_IN_CREDIT_MESSAGE : null;
}

export function buildSaleReturn(context: ReturnBuildContext): ReturnBuildResult {
  const { sale } = context;
  const selection = selectReturn(
    buildReturnableLines(sale, context.allReturns),
    context.quantities
  );
  const firstError = Object.values(selection.errors)[0];
  if (firstError !== undefined) return invalid(firstError);
  if (selection.picks.length === 0) return invalid(NOTHING_SELECTED_MESSAGE);
  const customer = context.customers.find(candidate => candidate.id === sale.customerId);
  const settlementProblem = checkSettlement(customer, context.settlement);
  if (settlementProblem !== null || customer === undefined) {
    return invalid(settlementProblem ?? '');
  }
  const working = new Map(context.products.map(product => [product.id, product]));
  const changed = new Map<string, Product>();
  const returnLines: SaleReturnLine[] = [];
  for (const pick of selection.picks) {
    const product = working.get(pick.line.productId);
    if (product === undefined) {
      return { ok: false, reason: 'stock', message: `${pick.line.name} is no longer on file.` };
    }
    const restocked = restockReturnLine({
      product,
      saleLine: pick.line.saleLine,
      priorAllocations: priorAllocations(context.allReturns, sale.id, pick.line.productId),
      quantity: pick.quantity,
      today: context.today,
      blockExpired: context.blockExpired,
    });
    if (!restocked.ok) return { ok: false, reason: 'stock', message: restocked.message };
    working.set(product.id, restocked.product);
    changed.set(product.id, restocked.product);
    returnLines.push({
      productId: pick.line.productId,
      sku: pick.line.sku,
      name: pick.line.name,
      unitPriceCents: pick.line.unitPriceCents,
      quantity: pick.quantity,
      totalCents: pick.valueCents,
      restockAllocations: restocked.allocations,
    });
  }
  const saleReturn: SaleReturn = {
    id: nextRecordId(
      'ret',
      context.allReturns.map(existing => existing.id)
    ),
    returnNo: nextDocumentNumber(
      'RET',
      context.allReturns.map(existing => existing.returnNo)
    ),
    originalSaleId: sale.id,
    originalInvoiceNo: sale.invoiceNo,
    customerId: customer.id,
    customerName: customer.name,
    lines: returnLines,
    totalCents: selection.totalCents,
    settlement: context.settlement,
    date: context.today,
    createdAt: context.now,
    processedByUserId: context.processedBy.id,
    processedByName: context.processedBy.name,
  };
  return { ok: true, saleReturn: cloneValue(saleReturn), products: Array.from(changed.values()) };
}

/**
 * Profit given back by a return: the value refunded less the cost of the stock that went back.
 */
export function returnProfitCents(saleReturn: SaleReturn): number {
  const cost = saleReturn.lines.reduce(
    (total, line) =>
      total +
      line.restockAllocations.reduce((sum, item) => sum + item.quantity * item.costCents, 0),
    0
  );
  return saleReturn.totalCents - cost;
}

export function returnItemCount(saleReturn: SaleReturn): number {
  return saleReturn.lines.reduce((total, line) => total + line.quantity, 0);
}
