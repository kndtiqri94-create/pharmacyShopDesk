import { BillDiscountInput } from '../models/domain/bill-discount.model';
import { BillLine } from '../models/domain/bill-line.model';
import { DiscountApproval } from '../models/domain/discount-approval.model';
import { PosSettings } from '../models/domain/pos-settings.model';
import { parseNonNegativeNumber } from './product-validation.util';
import { billDiscountCents, billDiscountPercent } from './pos-totals.util';

export const DISCOUNT_DECIMALS = 2;
export const DISCOUNT_TEXT_MAX_LENGTH = 6;
const PERCENT_TOLERANCE = 0.005;

export type DiscountRefusal = 'NOT_A_NUMBER' | 'ABOVE_MAXIMUM' | 'ABOVE_SUB_TOTAL' | 'DISABLED';

export type DiscountDecision =
  | { kind: 'NONE_NEEDED' }
  | { kind: 'NEEDS_APPROVAL' }
  | { kind: 'REFUSED'; reason: DiscountRefusal; message: string };

export function refusal(reason: DiscountRefusal, settings: PosSettings): DiscountDecision {
  const messages: Record<DiscountRefusal, string> = {
    NOT_A_NUMBER: 'Enter a discount from 0 to 100, with at most two decimals.',
    ABOVE_MAXIMUM: `The discount cannot be more than ${settings.maxDiscountPercent}%.`,
    ABOVE_SUB_TOTAL: 'The discount cannot be more than the sub total.',
    DISABLED: 'Discounts are turned off in Settings.',
  };
  return { kind: 'REFUSED', reason, message: messages[reason] };
}

export function parseDiscountPercent(text: string): number | null {
  const cleaned = text.trim().endsWith('.') ? text.trim().slice(0, -1) : text.trim();
  if (cleaned.length === 0 || cleaned.length > DISCOUNT_TEXT_MAX_LENGTH) return null;
  const value = parseNonNegativeNumber(cleaned, DISCOUNT_DECIMALS);
  return value === null || value > 100 ? null : value;
}

export function samePercent(first: number, second: number): boolean {
  return Math.abs(first - second) < PERCENT_TOLERANCE;
}

export function decideLineDiscount(
  percent: number | null,
  settings: PosSettings
): DiscountDecision {
  if (!settings.lineDiscountEnabled) return refusal('DISABLED', settings);
  if (percent === null || !Number.isFinite(percent) || percent < 0) {
    return refusal('NOT_A_NUMBER', settings);
  }
  if (percent > settings.maxDiscountPercent) return refusal('ABOVE_MAXIMUM', settings);
  return samePercent(percent, settings.defaultDiscountPercent)
    ? { kind: 'NONE_NEEDED' }
    : { kind: 'NEEDS_APPROVAL' };
}

export function decideBillDiscount(
  discount: BillDiscountInput | null,
  subTotalCents: number,
  settings: PosSettings
): DiscountDecision {
  if (!settings.billDiscountEnabled) return refusal('DISABLED', settings);
  if (discount === null) return refusal('NOT_A_NUMBER', settings);
  if (discount.mode === 'PERCENT') return decideBillPercent(discount.percent, settings);
  return decideBillAmount(discount.cents, subTotalCents, settings);
}

function decideBillPercent(percent: number, settings: PosSettings): DiscountDecision {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return refusal('NOT_A_NUMBER', settings);
  }
  if (percent > settings.maxDiscountPercent) return refusal('ABOVE_MAXIMUM', settings);
  return samePercent(percent, settings.defaultDiscountPercent)
    ? { kind: 'NONE_NEEDED' }
    : { kind: 'NEEDS_APPROVAL' };
}

function decideBillAmount(
  cents: number,
  subTotalCents: number,
  settings: PosSettings
): DiscountDecision {
  if (!Number.isSafeInteger(cents) || cents < 0) return refusal('NOT_A_NUMBER', settings);
  if (cents > subTotalCents) return refusal('ABOVE_SUB_TOTAL', settings);
  const highest = billDiscountCents(subTotalCents, {
    mode: 'PERCENT',
    percent: settings.maxDiscountPercent,
  });
  if (cents > highest) return refusal('ABOVE_MAXIMUM', settings);
  const atDefault = billDiscountCents(subTotalCents, {
    mode: 'PERCENT',
    percent: settings.defaultDiscountPercent,
  });
  return cents === atDefault ? { kind: 'NONE_NEEDED' } : { kind: 'NEEDS_APPROVAL' };
}

export function defaultBillDiscount(settings: PosSettings): BillDiscountInput {
  return {
    mode: 'PERCENT',
    percent: settings.billDiscountEnabled ? settings.defaultDiscountPercent : 0,
  };
}

export function defaultLineDiscountPercent(settings: PosSettings): number {
  return settings.lineDiscountEnabled ? settings.defaultDiscountPercent : 0;
}

function approvalMatchesLine(approval: DiscountApproval | null, line: BillLine): boolean {
  return (
    approval !== null &&
    approval.scope === 'LINE' &&
    approval.productId === line.productId &&
    samePercent(approval.percent, line.discountPercent)
  );
}

function lineDiscountProblem(line: BillLine, settings: PosSettings): string | null {
  const atDefault = samePercent(line.discountPercent, defaultLineDiscountPercent(settings));
  if (atDefault) return null;
  if (!settings.lineDiscountEnabled) return refusalMessage('DISABLED', settings);
  if (line.discountPercent > settings.maxDiscountPercent) {
    return refusalMessage('ABOVE_MAXIMUM', settings);
  }
  return approvalMatchesLine(line.discountApproval, line)
    ? null
    : `The discount on ${line.name} needs an Admin's approval.`;
}

function billDiscountProblem(
  discount: BillDiscountInput,
  approval: DiscountApproval | null,
  subTotalCents: number,
  settings: PosSettings
): string | null {
  const decision = decideBillDiscount(discount, subTotalCents, settings);
  if (decision.kind === 'REFUSED') {
    return decision.reason === 'DISABLED' && billAtDefault(discount, subTotalCents, settings)
      ? null
      : decision.message;
  }
  if (decision.kind === 'NONE_NEEDED') return null;
  const approved =
    approval !== null &&
    approval.scope === 'BILL' &&
    samePercent(approval.percent, billDiscountPercent(subTotalCents, discount));
  return approved ? null : "The bill discount needs an Admin's approval.";
}

function billAtDefault(
  discount: BillDiscountInput,
  subTotalCents: number,
  settings: PosSettings
): boolean {
  return (
    billDiscountCents(subTotalCents, discount) ===
    billDiscountCents(subTotalCents, defaultBillDiscount(settings))
  );
}

function refusalMessage(reason: DiscountRefusal, settings: PosSettings): string {
  const decision = refusal(reason, settings);
  return decision.kind === 'REFUSED' ? decision.message : '';
}

export function findDiscountProblem(
  lines: readonly BillLine[],
  discount: BillDiscountInput,
  approval: DiscountApproval | null,
  subTotalCents: number,
  settings: PosSettings
): string | null {
  for (const line of lines) {
    const problem = lineDiscountProblem(line, settings);
    if (problem !== null) return problem;
  }
  return billDiscountProblem(discount, approval, subTotalCents, settings);
}
