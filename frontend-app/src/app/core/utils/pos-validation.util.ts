import { PaymentEntries } from '../models/domain/payment-entries.model';
import { Product } from '../models/domain/product.model';
import { formatCount, rupeesToCents } from './money.util';
import { BillTotals, PaymentAmounts } from './pos-totals.util';
import { SellableStock } from './pos-stock-allocation.util';
import { MAX_PRICE_RUPEES, parseNonNegativeNumber } from './product-validation.util';

export const MAX_BILL_LINES = 100;
export const MAX_LINE_QUANTITY = 10_000;
export const REFERENCE_MAX_LENGTH = 40;
export const AMOUNT_TEXT_MAX_LENGTH = 12;
const AMOUNT_DECIMALS = 2;

export type AddRefusal = 'INACTIVE' | 'OUT_OF_STOCK' | 'EXPIRED' | 'LINE_LIMIT' | 'STOCK_LIMIT';

export type AddCheck = { ok: true } | { ok: false; reason: AddRefusal; message: string };

export type SaleErrorCode =
  'EMPTY_BILL' | 'PAYMENT_INCOMPLETE' | 'OVERPAID_NOT_CASH' | 'CREDIT_WALK_IN';

export interface SaleError {
  code: SaleErrorCode;
  message: string;
}

export type PaymentFieldKey = 'cash' | 'card' | 'online';

export type PaymentFieldErrors = Partial<Record<PaymentFieldKey, string>>;

export interface ParsedPayments {
  amounts: PaymentAmounts | null;
  errors: PaymentFieldErrors;
}

export const EMPTY_BILL_MESSAGE = 'The bill has no items. Add a product first.';
export const CREDIT_WALK_IN_MESSAGE =
  'Credit needs a named customer. Choose a customer, or take payment another way.';
const AMOUNT_ERROR = 'Enter an amount like 100 or 100.50.';

export function parseLineQuantity(text: string): number | null {
  const quantity = parseNonNegativeNumber(text, 0);
  return quantity === null || quantity < 1 || quantity > MAX_LINE_QUANTITY ? null : quantity;
}

export function invalidQuantityMessage(): string {
  return `Enter a whole quantity from 1 to ${formatCount(MAX_LINE_QUANTITY)}.`;
}

export function parseAmountCents(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  if (trimmed.length > AMOUNT_TEXT_MAX_LENGTH) return null;
  const cleaned = trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed;
  const rupees = parseNonNegativeNumber(cleaned, AMOUNT_DECIMALS);
  return rupees === null || rupees > MAX_PRICE_RUPEES ? null : rupeesToCents(rupees);
}

export function parsePaymentEntries(entries: PaymentEntries): ParsedPayments {
  const cash = parseAmountCents(entries.cash);
  const card = parseAmountCents(entries.card);
  const online = parseAmountCents(entries.online);
  const errors: PaymentFieldErrors = {};
  if (cash === null) errors.cash = AMOUNT_ERROR;
  if (card === null) errors.card = AMOUNT_ERROR;
  if (online === null) errors.online = AMOUNT_ERROR;
  if (cash === null || card === null || online === null) return { amounts: null, errors };
  return {
    amounts: {
      cashCents: cash,
      cardCents: card,
      onlineCents: online,
      creditSelected: entries.creditSelected,
    },
    errors,
  };
}

export function stockLimitMessage(productName: string, availableQuantity: number): string {
  return `Only ${formatCount(availableQuantity)} available for ${productName}.`;
}

export function checkProductAddable(
  product: Product,
  stock: SellableStock,
  lineCount: number,
  currentQuantity: number
): AddCheck {
  if (!product.active) {
    return refuse('INACTIVE', `${product.name} is not for sale. Switch it on in Products.`);
  }
  if (stock.totalQuantity <= 0) {
    return refuse('OUT_OF_STOCK', `${product.name} is out of stock.`);
  }
  if (stock.sellableQuantity <= 0) {
    return refuse('EXPIRED', `${product.name} is expired and cannot be sold.`);
  }
  if (currentQuantity === 0 && lineCount >= MAX_BILL_LINES) {
    return refuse(
      'LINE_LIMIT',
      `A bill can have at most ${MAX_BILL_LINES} items. Save or hold this bill first.`
    );
  }
  if (currentQuantity + 1 > stock.sellableQuantity) {
    return refuse('STOCK_LIMIT', stockLimitMessage(product.name, stock.sellableQuantity));
  }
  return { ok: true };
}

function refuse(reason: AddRefusal, message: string): AddCheck {
  return { ok: false, reason, message };
}

export function checkQuantityAgainstStock(
  productName: string,
  quantity: number,
  stock: SellableStock
): AddCheck {
  return quantity > stock.sellableQuantity
    ? refuse('STOCK_LIMIT', stockLimitMessage(productName, stock.sellableQuantity))
    : { ok: true };
}

export interface SaleReadinessInput {
  lineCount: number;
  totals: BillTotals;
  amounts: PaymentAmounts;
  isWalkIn: boolean;
}

export function validateHold(lineCount: number): SaleError | null {
  return lineCount === 0 ? { code: 'EMPTY_BILL', message: EMPTY_BILL_MESSAGE } : null;
}

export function validateSaleReadiness(input: SaleReadinessInput): SaleError | null {
  const { totals, amounts } = input;
  const empty = validateHold(input.lineCount);
  if (empty !== null) return empty;
  if (totals.creditCents > 0 && input.isWalkIn) {
    return { code: 'CREDIT_WALK_IN', message: CREDIT_WALK_IN_MESSAGE };
  }
  if (totals.balanceKind === 'DUE') {
    return {
      code: 'PAYMENT_INCOMPLETE',
      message: 'Payment is incomplete. Enter the rest, or choose Credit for a named customer.',
    };
  }
  if (amounts.cardCents + amounts.onlineCents > totals.totalCents) {
    return {
      code: 'OVERPAID_NOT_CASH',
      message: 'Only cash can be more than the amount due. Lower the card or online amount.',
    };
  }
  return null;
}
