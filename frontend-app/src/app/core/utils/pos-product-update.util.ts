import { BillLine } from '../models/domain/bill-line.model';
import { Product } from '../models/domain/product.model';
import { sortBatchesByExpiry } from './batch-order.util';
import { formatRupeesExact } from './money.util';
import { checkProductAddable, parseRequiredAmountCents } from './pos-validation.util';
import { getSellableStock, isBatchExpired } from './pos-stock-allocation.util';
import { MAX_QUANTITY, parseNonNegativeNumber } from './product-validation.util';
import { getStockOnHand } from './stock-status.util';

export const PRICE_ERROR_MESSAGE = 'Enter the selling price like 250 or 250.50, zero or more.';
export const STOCK_ERROR_MESSAGE = 'Enter the stock as a whole number, zero or more.';
export const NOTHING_CHANGED_MESSAGE = 'Nothing changed. Edit the price or the stock first.';

export interface ProductUpdateValues {
  priceCents: number;
  stock: number;
}

export interface ProductUpdateErrors {
  price?: string;
  stock?: string;
}

export interface ProductUpdateValidation {
  errors: ProductUpdateErrors;
  values: ProductUpdateValues | null;
}

export interface ProductUpdateDiff {
  priceChanged: boolean;
  stockChanged: boolean;
  oldPriceCents: number;
  newPriceCents: number;
  oldStock: number;
  newStock: number;
}

export function parseStockFigure(text: string): number | null {
  const stock = parseNonNegativeNumber(text, 0);
  return stock === null || stock > MAX_QUANTITY ? null : stock;
}

export function validateProductUpdate(
  priceText: string,
  stockText: string
): ProductUpdateValidation {
  const priceCents = parseRequiredAmountCents(priceText);
  const stock = parseStockFigure(stockText);
  const errors: ProductUpdateErrors = {};
  if (priceCents === null) errors.price = PRICE_ERROR_MESSAGE;
  if (stock === null) errors.stock = STOCK_ERROR_MESSAGE;
  if (priceCents === null || stock === null) return { errors, values: null };
  return { errors, values: { priceCents, stock } };
}

export function diffProductUpdate(
  product: Product,
  values: ProductUpdateValues
): ProductUpdateDiff {
  const oldStock = getStockOnHand(product);
  return {
    priceChanged: product.priceCents !== values.priceCents,
    stockChanged: oldStock !== values.stock,
    oldPriceCents: product.priceCents,
    newPriceCents: values.priceCents,
    oldStock,
    newStock: values.stock,
  };
}

function usesBatches(product: Product): boolean {
  return product.trackBatches && product.batches.length > 0;
}

function addStock(product: Product, quantity: number, today: string): Product {
  const batches = sortBatchesByExpiry(product.batches);
  const target = batches.find(batch => !isBatchExpired(batch, today)) ?? batches[0];
  const index = batches.indexOf(target);
  batches[index] = { ...target, quantity: target.quantity + quantity };
  return { ...product, batches };
}

function removeStock(product: Product, quantity: number): Product {
  let remaining = quantity;
  const batches = sortBatchesByExpiry(product.batches).map(batch => {
    if (remaining === 0 || batch.quantity <= 0) return batch;
    const taken = Math.min(batch.quantity, remaining);
    remaining -= taken;
    return { ...batch, quantity: batch.quantity - taken };
  });
  return { ...product, batches };
}

export function applyProductUpdate(
  product: Product,
  values: ProductUpdateValues,
  today: string
): Product {
  const priced = { ...product, priceCents: values.priceCents };
  if (!usesBatches(priced)) return { ...priced, stockOnHand: values.stock };
  const delta = values.stock - getStockOnHand(priced);
  if (delta > 0) return addStock(priced, delta, today);
  return delta < 0 ? removeStock(priced, -delta) : priced;
}

export interface BillRecheck {
  lines: BillLine[];
  notes: string[];
}

export function recheckBillLines(
  lines: readonly BillLine[],
  products: readonly Product[],
  today: string,
  blockExpired: boolean
): BillRecheck {
  const notes: string[] = [];
  const rechecked = lines.map(line => {
    const product = products.find(candidate => candidate.id === line.productId);
    if (product === undefined || !product.active) {
      notes.push(`${line.name} is no longer for sale. Remove it before saving.`);
      return line;
    }
    if (line.unitPriceCents !== product.priceCents) {
      notes.push(`The price of ${line.name} is now ${formatRupeesExact(product.priceCents)}.`);
    }
    const stock = getSellableStock(product, today, blockExpired);
    const check = checkProductAddable(product, stock, 0, line.quantity - 1);
    if (!check.ok) notes.push(`${check.message} Change the quantity or remove it.`);
    return { ...line, unitPriceCents: product.priceCents };
  });
  return { lines: rechecked, notes };
}
