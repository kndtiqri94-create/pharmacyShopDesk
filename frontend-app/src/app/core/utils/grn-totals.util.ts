import { PaymentStatus } from '../models/enums/payment-status.enum';

export interface GrnLineAmounts {
  receivedQuantity: number;
  freeQuantity: number;
  costCents: number;
}

export interface GrnTotals {
  lineCount: number;
  unitCount: number;
  subTotalCents: number;
  discountCents: number;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
}

export function grnLineTotalCents(line: GrnLineAmounts): number {
  return line.receivedQuantity * line.costCents;
}

export function derivePaymentStatus(totalCents: number, paidCents: number): PaymentStatus {
  if (paidCents >= totalCents) return PaymentStatus.PAID;
  return paidCents > 0 ? PaymentStatus.PART_PAID : PaymentStatus.UNPAID;
}

export function computeGrnTotals(
  lines: readonly GrnLineAmounts[],
  discountCents: number,
  paidCents: number
): GrnTotals {
  const subTotalCents = lines.reduce((sum, line) => sum + grnLineTotalCents(line), 0);
  const totalCents = Math.max(0, subTotalCents - discountCents);
  return {
    lineCount: lines.length,
    unitCount: lines.reduce((sum, line) => sum + line.receivedQuantity + line.freeQuantity, 0),
    subTotalCents,
    discountCents,
    totalCents,
    paidCents,
    balanceCents: Math.max(0, totalCents - paidCents),
  };
}
