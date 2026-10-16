import { Grn } from '../models/domain/grn.model';
import { GrnLine } from '../models/domain/grn-line.model';
import { Product } from '../models/domain/product.model';
import { PurchaseOrder } from '../models/domain/purchase-order.model';
import { Supplier } from '../models/domain/supplier.model';
import { PaymentMethod } from '../models/enums/payment-method.enum';
import { PoStatus } from '../models/enums/po-status.enum';
import { isIsoDate, parseExpiryInput } from './date.util';
import { computeGrnTotals, derivePaymentStatus } from './grn-totals.util';
import { formatRupees } from './money.util';
import { parsePaymentMethod } from './payment-method-display.util';
import { parseCents, parseQuantity } from './number-input.util';

export const MAX_GRN_LINES = 200;
export const GRN_TEXT_MAX_LENGTH = { batchNo: 40, invoiceNo: 40 } as const;
const BATCH_NO_CHARACTERS = /^[A-Za-z0-9._/-]+$/;
const RECEIVABLE_ORDER_STATUSES: readonly PoStatus[] = [PoStatus.SENT, PoStatus.PART_RECEIVED];

export type GrnLineField = 'batchNo' | 'expiry' | 'received' | 'free' | 'cost';

export interface GrnLineInput {
  productId: string;
  batchNo: string;
  expiry: string;
  received: string;
  free: string;
  cost: string;
  price: string;
}

export interface GrnFormInput {
  supplierId: string;
  purchaseOrderId: string;
  receivedDate: string;
  invoiceNo: string;
  invoiceDate: string;
  paymentMethod: string;
  paidNow: string;
  dueDate: string;
  discount: string;
  lines: GrnLineInput[];
}

export type GrnFieldErrors = Record<string, string>;

export interface GrnValidationContext {
  products: readonly Product[];
  suppliers: readonly Supplier[];
  orders: readonly PurchaseOrder[];
  strict: boolean;
}

export type ValidatedGrn = Pick<
  Grn,
  | 'receivedDate'
  | 'supplierId'
  | 'invoiceNo'
  | 'invoiceDate'
  | 'purchaseOrderNumber'
  | 'paymentStatus'
  | 'paymentMethod'
  | 'paidCents'
  | 'dueDate'
  | 'discountCents'
  | 'totalCents'
  | 'lines'
>;

export interface GrnValidationResult {
  errors: GrnFieldErrors;
  firstErrorField: string | null;
  values: ValidatedGrn | null;
}

export function grnLineKey(index: number, field: GrnLineField): string {
  return `line-${index}-${field}`;
}

export function isReceivableOrder(order: PurchaseOrder): boolean {
  return RECEIVABLE_ORDER_STATUSES.includes(order.status);
}

function errorOrder(lineCount: number): string[] {
  const lineKeys = Array.from({ length: lineCount }, (_, index) =>
    (['batchNo', 'expiry', 'received', 'free', 'cost'] as const).map(field =>
      grnLineKey(index, field)
    )
  ).flat();
  return [
    'supplierId',
    'purchaseOrderId',
    'receivedDate',
    'invoiceNo',
    'invoiceDate',
    'paymentMethod',
    'paidNow',
    'dueDate',
    'lines',
    ...lineKeys,
    'discount',
  ];
}

function optionalDate(text: string, errors: GrnFieldErrors, key: string, message: string): string {
  const trimmed = text.trim();
  if (trimmed !== '' && !isIsoDate(trimmed)) errors[key] = message;
  return trimmed;
}

function validateLineBatch(
  line: GrnLineInput,
  index: number,
  errors: GrnFieldErrors,
  strict: boolean
): string {
  const batchNo = line.batchNo.trim();
  const key = grnLineKey(index, 'batchNo');
  if (batchNo === '' && strict) errors[key] = 'Enter the batch number';
  else if (batchNo.length > GRN_TEXT_MAX_LENGTH.batchNo)
    errors[key] = 'Batch number must be 40 characters or fewer';
  else if (batchNo !== '' && !BATCH_NO_CHARACTERS.test(batchNo))
    errors[key] =
      'Use only letters, numbers, dots, dashes, slashes or underscores in the batch number';
  return batchNo;
}

function validateLineExpiry(
  line: GrnLineInput,
  index: number,
  errors: GrnFieldErrors,
  strict: boolean
): string | null {
  const text = line.expiry.trim();
  if (text === '' && !strict) return null;
  const iso = parseExpiryInput(text);
  if (iso === null)
    errors[grnLineKey(index, 'expiry')] = 'Enter the expiry as MM/YYYY, for example 03/2028';
  return iso;
}

function validateLineNumbers(
  line: GrnLineInput,
  index: number,
  errors: GrnFieldErrors,
  strict: boolean
): Pick<GrnLine, 'receivedQuantity' | 'freeQuantity' | 'costCents'> {
  const received = line.received.trim() === '' && !strict ? 0 : parseQuantity(line.received);
  const free = line.free.trim() === '' ? 0 : parseQuantity(line.free);
  const cost = line.cost.trim() === '' && !strict ? 0 : parseCents(line.cost);
  const mustBeAboveZero = strict || line.received.trim() !== '';
  if (received === null || (mustBeAboveZero && received <= 0))
    errors[grnLineKey(index, 'received')] = 'Enter a received quantity above 0';
  if (free === null)
    errors[grnLineKey(index, 'free')] = 'Enter the free quantity as a whole number, zero or more';
  if (cost === null)
    errors[grnLineKey(index, 'cost')] = 'Enter the cost as an amount, zero or more';
  return { receivedQuantity: received ?? 0, freeQuantity: free ?? 0, costCents: cost ?? 0 };
}

function validateLines(
  input: GrnFormInput,
  context: GrnValidationContext,
  errors: GrnFieldErrors
): GrnLine[] {
  if (input.lines.length > MAX_GRN_LINES) {
    errors['lines'] = `You can receive up to ${MAX_GRN_LINES} items on one GRN`;
    return [];
  }
  if (input.lines.length === 0 && context.strict) {
    errors['lines'] = 'Add an item first, then receive stock';
  }
  return input.lines.map((line, index) => {
    const product = context.products.find(candidate => candidate.id === line.productId);
    if (!product)
      errors['lines'] = 'An item is no longer in your product list. Remove it and add it again';
    return {
      productId: line.productId,
      batchNo: validateLineBatch(line, index, errors, context.strict),
      expiryDate: validateLineExpiry(line, index, errors, context.strict),
      ...validateLineNumbers(line, index, errors, context.strict),
      priceCents: parseCents(line.price) ?? product?.priceCents ?? 0,
    };
  });
}

function validateSupplier(
  input: GrnFormInput,
  context: GrnValidationContext,
  errors: GrnFieldErrors
): string {
  const supplierId = input.supplierId.trim();
  const known = context.suppliers.some(supplier => supplier.id === supplierId);
  if ((supplierId === '' && context.strict) || (supplierId !== '' && !known)) {
    errors['supplierId'] = 'Choose the supplier';
  }
  return supplierId;
}

function validateOrder(
  input: GrnFormInput,
  supplierId: string,
  context: GrnValidationContext,
  errors: GrnFieldErrors
): string | null {
  const orderId = input.purchaseOrderId.trim();
  if (orderId === '') return null;
  const order = context.orders.find(candidate => candidate.id === orderId);
  const supplierMatches = supplierId === '' || order?.supplierId === supplierId;
  if (!order || !isReceivableOrder(order) || !supplierMatches) {
    errors['purchaseOrderId'] = 'Choose a purchase order that is still open for this supplier';
    return null;
  }
  return order.number;
}

function validateInvoice(input: GrnFormInput, errors: GrnFieldErrors, strict: boolean): string {
  const invoiceNo = input.invoiceNo.trim();
  if (invoiceNo === '' && strict) errors['invoiceNo'] = 'Enter the supplier invoice number';
  else if (invoiceNo.length > GRN_TEXT_MAX_LENGTH.invoiceNo)
    errors['invoiceNo'] = 'Invoice number must be 40 characters or fewer';
  return invoiceNo;
}

function validateMoney(
  input: GrnFormInput,
  subTotalCents: number,
  errors: GrnFieldErrors
): { discountCents: number; paidCents: number } {
  const discount = input.discount.trim() === '' ? 0 : parseCents(input.discount);
  const paid = input.paidNow.trim() === '' ? 0 : parseCents(input.paidNow);
  if (discount === null) errors['discount'] = 'Enter the discount as an amount, zero or more';
  else if (discount > subTotalCents)
    errors['discount'] = 'The discount cannot be more than the items total';
  if (paid === null) errors['paidNow'] = 'Enter the amount paid now as an amount, zero or more';
  return { discountCents: discount ?? 0, paidCents: paid ?? 0 };
}

export function validateGrn(
  input: GrnFormInput,
  context: GrnValidationContext
): GrnValidationResult {
  const errors: GrnFieldErrors = {};
  const supplierId = validateSupplier(input, context, errors);
  const purchaseOrderNumber = validateOrder(input, supplierId, context, errors);
  const receivedDate = input.receivedDate.trim();
  if (!isIsoDate(receivedDate)) errors['receivedDate'] = 'Enter the date you received the delivery';
  const invoiceNo = validateInvoice(input, errors, context.strict);
  const invoiceDate = optionalDate(
    input.invoiceDate,
    errors,
    'invoiceDate',
    'Enter the invoice date as a real date'
  );
  const dueDate = optionalDate(
    input.dueDate,
    errors,
    'dueDate',
    'Enter the due date as a real date'
  );
  const paymentMethod = parsePaymentMethod(input.paymentMethod);
  if (paymentMethod === null) errors['paymentMethod'] = 'Choose a payment method';
  const lines = validateLines(input, context, errors);
  const subTotalCents = computeGrnTotals(lines, 0, 0).subTotalCents;
  const { discountCents, paidCents } = validateMoney(input, subTotalCents, errors);
  const totalCents = computeGrnTotals(lines, discountCents, paidCents).totalCents;
  if (paidCents > totalCents && errors['paidNow'] === undefined)
    errors['paidNow'] = `Paid now cannot be more than the total (${formatRupees(totalCents)})`;
  const firstErrorField =
    errorOrder(input.lines.length).find(key => errors[key] !== undefined) ?? null;
  if (firstErrorField !== null) return { errors, firstErrorField, values: null };
  return {
    errors,
    firstErrorField: null,
    values: {
      receivedDate,
      supplierId,
      invoiceNo,
      invoiceDate,
      purchaseOrderNumber,
      paymentStatus: derivePaymentStatus(totalCents, paidCents),
      paymentMethod: paymentMethod ?? PaymentMethod.CREDIT,
      paidCents,
      dueDate: dueDate === '' ? null : dueDate,
      discountCents,
      totalCents,
      lines,
    },
  };
}
