import { Product } from '../models/domain/product.model';
import { PurchaseOrder } from '../models/domain/purchase-order.model';
import { PurchaseOrderLine } from '../models/domain/purchase-order-line.model';
import { Supplier } from '../models/domain/supplier.model';
import { daysBetween, isIsoDate } from './date.util';
import { MAX_GRN_LINES } from './grn-validation.util';
import { parseCents, parseQuantity } from './number-input.util';
import { computePurchaseOrderTotals } from './purchase-order-totals.util';

export const PURCHASE_ORDER_NOTES_MAX_LENGTH = 300;

export type PurchaseOrderLineField = 'quantity' | 'unitCost';

export interface PurchaseOrderLineInput {
  productId: string;
  quantity: string;
  unitCost: string;
}

export interface PurchaseOrderFormInput {
  supplierId: string;
  orderDate: string;
  expectedDate: string;
  notes: string;
  delivery: string;
  lines: PurchaseOrderLineInput[];
}

export type PurchaseOrderFieldErrors = Record<string, string>;

export interface PurchaseOrderValidationContext {
  products: readonly Product[];
  suppliers: readonly Supplier[];
  strict: boolean;
}

export type ValidatedPurchaseOrder = Pick<
  PurchaseOrder,
  'supplierId' | 'orderDate' | 'expectedDate' | 'notes' | 'deliveryCents' | 'totalCents' | 'lines'
>;

export interface PurchaseOrderValidationResult {
  errors: PurchaseOrderFieldErrors;
  firstErrorField: string | null;
  values: ValidatedPurchaseOrder | null;
}

export function purchaseOrderLineKey(index: number, field: PurchaseOrderLineField): string {
  return `line-${index}-${field}`;
}

function errorOrder(lineCount: number): string[] {
  const lineKeys = Array.from({ length: lineCount }, (_, index) => [
    purchaseOrderLineKey(index, 'quantity'),
    purchaseOrderLineKey(index, 'unitCost'),
  ]).flat();
  return ['supplierId', 'orderDate', 'expectedDate', 'notes', 'lines', ...lineKeys, 'delivery'];
}

function validateSupplier(
  input: PurchaseOrderFormInput,
  context: PurchaseOrderValidationContext,
  errors: PurchaseOrderFieldErrors
): string {
  const supplierId = input.supplierId.trim();
  const known = context.suppliers.some(supplier => supplier.id === supplierId);
  if ((supplierId === '' && context.strict) || (supplierId !== '' && !known)) {
    errors['supplierId'] = 'Choose the supplier';
  }
  return supplierId;
}

function validateDates(
  input: PurchaseOrderFormInput,
  errors: PurchaseOrderFieldErrors
): { orderDate: string; expectedDate: string } {
  const orderDate = input.orderDate.trim();
  const expectedDate = input.expectedDate.trim();
  if (!isIsoDate(orderDate)) errors['orderDate'] = 'Enter the order date as a real date';
  if (expectedDate !== '' && !isIsoDate(expectedDate)) {
    errors['expectedDate'] = 'Enter the expected delivery as a real date';
  } else if (expectedDate !== '' && daysBetween(orderDate, expectedDate) < 0) {
    errors['expectedDate'] = 'The expected delivery cannot be before the order date';
  }
  return { orderDate, expectedDate };
}

function validateLines(
  input: PurchaseOrderFormInput,
  context: PurchaseOrderValidationContext,
  errors: PurchaseOrderFieldErrors
): PurchaseOrderLine[] {
  if (input.lines.length > MAX_GRN_LINES) {
    errors['lines'] = `You can order up to ${MAX_GRN_LINES} items on one purchase order`;
    return [];
  }
  if (input.lines.length === 0 && context.strict) errors['lines'] = 'Add an item to order first';
  return input.lines.map((line, index) => {
    const product = context.products.find(candidate => candidate.id === line.productId);
    if (!product)
      errors['lines'] = 'An item is no longer in your product list. Remove it and add it again';
    const quantity =
      line.quantity.trim() === '' && !context.strict ? 0 : parseQuantity(line.quantity);
    const unitCost = line.unitCost.trim() === '' && !context.strict ? 0 : parseCents(line.unitCost);
    const mustBeAboveZero = context.strict || line.quantity.trim() !== '';
    if (quantity === null || (mustBeAboveZero && quantity <= 0))
      errors[purchaseOrderLineKey(index, 'quantity')] = 'Enter an order quantity above 0';
    if (unitCost === null)
      errors[purchaseOrderLineKey(index, 'unitCost')] =
        'Enter the unit cost as an amount, zero or more';
    return {
      productId: line.productId,
      orderedQuantity: quantity ?? 0,
      receivedQuantity: 0,
      unitCostCents: unitCost ?? 0,
    };
  });
}

export function validatePurchaseOrder(
  input: PurchaseOrderFormInput,
  context: PurchaseOrderValidationContext
): PurchaseOrderValidationResult {
  const errors: PurchaseOrderFieldErrors = {};
  const supplierId = validateSupplier(input, context, errors);
  const { orderDate, expectedDate } = validateDates(input, errors);
  const notes = input.notes.trim();
  if (notes.length > PURCHASE_ORDER_NOTES_MAX_LENGTH)
    errors['notes'] = 'Notes must be 300 characters or fewer';
  const lines = validateLines(input, context, errors);
  const delivery = input.delivery.trim() === '' ? 0 : parseCents(input.delivery);
  if (delivery === null)
    errors['delivery'] = 'Enter the delivery charge as an amount, zero or more';
  const deliveryCents = delivery ?? 0;
  const totals = computePurchaseOrderTotals(
    lines.map(line => ({ quantity: line.orderedQuantity, unitCostCents: line.unitCostCents })),
    deliveryCents
  );
  const firstErrorField =
    errorOrder(input.lines.length).find(key => errors[key] !== undefined) ?? null;
  if (firstErrorField !== null) return { errors, firstErrorField, values: null };
  return {
    errors,
    firstErrorField: null,
    values: {
      supplierId,
      orderDate,
      expectedDate,
      notes,
      deliveryCents,
      totalCents: totals.totalCents,
      lines,
    },
  };
}
