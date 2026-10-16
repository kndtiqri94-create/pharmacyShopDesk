import { Grn } from '../models/domain/grn.model';
import { GrnStatus } from '../models/enums/grn-status.enum';
import { daysBetween } from './date.util';

export interface UnpaidSummary {
  totalCents: number;
  invoiceCount: number;
  oldestDays: number;
}

export function grnBalanceCents(grn: Grn): number {
  return Math.max(0, grn.totalCents - grn.paidCents);
}

export function unpaidGrns(grns: readonly Grn[]): Grn[] {
  return grns.filter(grn => grn.status === GrnStatus.RECEIVED && grnBalanceCents(grn) > 0);
}

export function amountOwedToSupplier(grns: readonly Grn[], supplierId: string): number {
  return unpaidGrns(grns)
    .filter(grn => grn.supplierId === supplierId)
    .reduce((total, grn) => total + grnBalanceCents(grn), 0);
}

export function summarizeUnpaid(grns: readonly Grn[], today: string): UnpaidSummary {
  const unpaid = unpaidGrns(grns);
  const ages = unpaid.map(grn => daysBetween(grn.receivedDate, today)).filter(Number.isFinite);
  return {
    totalCents: unpaid.reduce((total, grn) => total + grnBalanceCents(grn), 0),
    invoiceCount: unpaid.length,
    oldestDays: ages.reduce((oldest, age) => Math.max(oldest, age), 0),
  };
}
