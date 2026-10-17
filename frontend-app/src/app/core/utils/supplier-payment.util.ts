import { Grn } from '../models/domain/grn.model';
import { SupplierPaymentAllocation } from '../models/domain/supplier-payment.model';
import { cloneValue } from './clone.util';
import { derivePaymentStatus } from './grn-totals.util';
import { grnBalanceCents, unpaidGrns } from './supplier-owed.util';

export interface PaymentAllocationResult {
  grns: Grn[];
  allocations: SupplierPaymentAllocation[];
  allocatedCents: number;
}

function oldestFirst(first: Grn, second: Grn): number {
  return (
    first.receivedDate.localeCompare(second.receivedDate) ||
    first.number.localeCompare(second.number)
  );
}

export function allocatePayment(
  grns: readonly Grn[],
  supplierId: string,
  amountCents: number
): PaymentAllocationResult {
  const result: PaymentAllocationResult = { grns: [], allocations: [], allocatedCents: 0 };
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) return result;
  const candidates = unpaidGrns(grns)
    .filter(grn => grn.supplierId === supplierId)
    .sort(oldestFirst);
  let remaining = amountCents;
  for (const grn of candidates) {
    if (remaining === 0) break;
    const applied = Math.min(remaining, grnBalanceCents(grn));
    const updated = cloneValue(grn);
    updated.paidCents = grn.paidCents + applied;
    updated.paymentStatus = derivePaymentStatus(updated.totalCents, updated.paidCents);
    result.grns.push(updated);
    result.allocations.push({ grnId: grn.id, amountCents: applied });
    remaining -= applied;
  }
  result.allocatedCents = amountCents - remaining;
  return result;
}
