import { BillDiscountInput } from '../models/domain/bill-discount.model';
import { divideRoundHalfUp } from './money.util';

/**
 * Rounding rule for every till amount: money is whole cents, percentages carry at most two
 * decimals (scaled by 100 into whole basis points), and every division rounds half up.
 */
const PERCENT_BASIS = 10_000;
const PERCENT_SCALE = 100;

export interface PricedLine {
  unitPriceCents: number;
  quantity: number;
  discountPercent: number;
}

export interface PaymentAmounts {
  cashCents: number;
  cardCents: number;
  onlineCents: number;
  creditSelected: boolean;
}

export type BalanceKind = 'DUE' | 'CHANGE' | 'CREDIT_DUE' | 'SETTLED';

export interface BillTotals {
  itemCount: number;
  subTotalCents: number;
  discountCents: number;
  discountPercent: number;
  totalCents: number;
  paidCents: number;
  balanceKind: BalanceKind;
  balanceCents: number;
  creditCents: number;
  changeCents: number;
}

export function lineGrossCents(unitPriceCents: number, quantity: number): number {
  return unitPriceCents * quantity;
}

export function lineDiscountCents(grossCents: number, percent: number): number {
  return divideRoundHalfUp(grossCents * Math.round(percent * PERCENT_SCALE), PERCENT_BASIS);
}

export function lineTotalCents(line: PricedLine): number {
  const gross = lineGrossCents(line.unitPriceCents, line.quantity);
  return gross - lineDiscountCents(gross, line.discountPercent);
}

export function percentFromCents(discountCents: number, subTotalCents: number): number {
  if (subTotalCents <= 0 || discountCents <= 0) return 0;
  return divideRoundHalfUp(discountCents * PERCENT_BASIS, subTotalCents) / PERCENT_SCALE;
}

export function billDiscountCents(subTotalCents: number, discount: BillDiscountInput): number {
  const requested =
    discount.mode === 'PERCENT'
      ? divideRoundHalfUp(
          subTotalCents * Math.round(discount.percent * PERCENT_SCALE),
          PERCENT_BASIS
        )
      : discount.cents;
  return Math.min(Math.max(0, requested), Math.max(0, subTotalCents));
}

export function billDiscountPercent(subTotalCents: number, discount: BillDiscountInput): number {
  return discount.mode === 'PERCENT'
    ? discount.percent
    : percentFromCents(billDiscountCents(subTotalCents, discount), subTotalCents);
}

export function computeBillTotals(
  lines: readonly PricedLine[],
  discount: BillDiscountInput,
  payments: PaymentAmounts
): BillTotals {
  const subTotalCents = lines.reduce((total, line) => total + lineTotalCents(line), 0);
  const discountCents = billDiscountCents(subTotalCents, discount);
  const totalCents = subTotalCents - discountCents;
  const paidCents = payments.cashCents + payments.cardCents + payments.onlineCents;
  const remaining = totalCents - paidCents;
  const shared = {
    itemCount: lines.length,
    subTotalCents,
    discountCents,
    discountPercent: billDiscountPercent(subTotalCents, discount),
    totalCents,
    paidCents,
  };
  if (remaining < 0) {
    return {
      ...shared,
      balanceKind: 'CHANGE',
      balanceCents: -remaining,
      creditCents: 0,
      changeCents: -remaining,
    };
  }
  if (remaining === 0) {
    return { ...shared, balanceKind: 'SETTLED', balanceCents: 0, creditCents: 0, changeCents: 0 };
  }
  return {
    ...shared,
    balanceKind: payments.creditSelected ? 'CREDIT_DUE' : 'DUE',
    balanceCents: remaining,
    creditCents: payments.creditSelected ? remaining : 0,
    changeCents: 0,
  };
}
