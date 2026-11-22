import { formatRupees, rupeesToCents } from './money.util';
import { parseNonNegativeNumber } from './product-validation.util';

export const PAYMENT_AMOUNT_DECIMALS = 2;
export const PAYMENT_AMOUNT_MAX_LENGTH = 15;

export type PaymentAmountResult =
  { amountCents: number; error: null } | { amountCents: null; error: string };

function invalid(error: string): PaymentAmountResult {
  return { amountCents: null, error };
}

export function validatePaymentAmount(text: string, outstandingCents: number): PaymentAmountResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) return invalid('Enter the amount you are paying');
  if (trimmed.startsWith('-')) return invalid('Enter an amount above zero');
  const rupees = parseNonNegativeNumber(trimmed, PAYMENT_AMOUNT_DECIMALS);
  if (rupees === null) return invalid('Enter the amount as a number, for example 1500.00');
  if (rupees === 0) return invalid('Enter an amount above zero');
  const amountCents = rupeesToCents(rupees);
  if (amountCents > outstandingCents) {
    return invalid(`The amount can be at most ${formatRupees(outstandingCents)}`);
  }
  return { amountCents, error: null };
}
