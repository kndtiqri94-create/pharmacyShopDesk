import { Grn } from '../models/domain/grn.model';
import { GrnStatus } from '../models/enums/grn-status.enum';
import { PaymentStatus } from '../models/enums/payment-status.enum';
import { GRN_SEED } from '../services/data/in-memory/seed/grn.seed';
import { allocatePayment } from './supplier-payment.util';
import { amountOwedToSupplier } from './supplier-owed.util';

function grn(overrides: Partial<Grn>): Grn {
  return {
    ...GRN_SEED[0],
    status: GrnStatus.RECEIVED,
    paymentStatus: PaymentStatus.UNPAID,
    paidCents: 0,
    ...overrides,
  };
}

describe('supplier-payment.util', () => {
  const older = grn({
    id: 'g-1',
    number: 'GRN-0001',
    receivedDate: '2026-09-01',
    totalCents: 100_000,
  });
  const newer = grn({
    id: 'g-2',
    number: 'GRN-0002',
    receivedDate: '2026-09-05',
    totalCents: 200_000,
  });
  const sameDay = grn({
    id: 'g-3',
    number: 'GRN-0003',
    receivedDate: '2026-09-05',
    totalCents: 50_000,
  });
  const all = [sameDay, newer, older];

  it('settles the oldest received GRN fully before moving to the next', () => {
    const result = allocatePayment(all, 'sup-001', 100_000);
    expect(result.allocations).toEqual([{ grnId: 'g-1', amountCents: 100_000 }]);
    expect(result.grns[0].paymentStatus).toBe(PaymentStatus.PAID);
    expect(result.allocatedCents).toBe(100_000);
  });

  it('orders by received date and then by GRN number', () => {
    const result = allocatePayment(all, 'sup-001', 350_000);
    expect(result.allocations.map(item => item.grnId)).toEqual(['g-1', 'g-2', 'g-3']);
  });

  it('leaves the last GRN part paid with the correct balance when the amount runs out', () => {
    const result = allocatePayment(all, 'sup-001', 150_000);
    expect(result.allocations).toEqual([
      { grnId: 'g-1', amountCents: 100_000 },
      { grnId: 'g-2', amountCents: 50_000 },
    ]);
    expect(result.grns[1].paidCents).toBe(50_000);
    expect(result.grns[1].paymentStatus).toBe(PaymentStatus.PART_PAID);
  });

  it('builds on what was already paid and keeps integer cents', () => {
    const partial = grn({ id: 'g-4', totalCents: 100_001, paidCents: 40_001 });
    const result = allocatePayment([partial], 'sup-001', 33);
    expect(result.grns[0].paidCents).toBe(40_034);
    expect(Number.isInteger(result.grns[0].paidCents)).toBeTrue();
  });

  it('never changes the GRNs passed in', () => {
    const snapshot = structuredClone(all);
    allocatePayment(all, 'sup-001', 150_000);
    expect(all).toEqual(snapshot);
  });

  it('only touches received GRNs of that supplier', () => {
    const other = grn({ id: 'g-5', supplierId: 'sup-002', totalCents: 70_000 });
    const draft = grn({ id: 'g-6', status: GrnStatus.DRAFT, totalCents: 70_000 });
    const cancelled = grn({ id: 'g-7', status: GrnStatus.CANCELLED, totalCents: 70_000 });
    const result = allocatePayment([other, draft, cancelled, older], 'sup-001', 1_000_000);
    expect(result.allocations.map(item => item.grnId)).toEqual(['g-1']);
    expect(result.allocatedCents).toBe(100_000);
  });

  it('applies nothing for a zero, negative, fractional or non-finite amount', () => {
    for (const amount of [0, -5, 10.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = allocatePayment(all, 'sup-001', amount);
      expect(result.grns).toEqual([]);
      expect(result.allocatedCents).toBe(0);
    }
  });

  it('lowers the amount owed by exactly the amount paid', () => {
    const before = amountOwedToSupplier(all, 'sup-001');
    const result = allocatePayment(all, 'sup-001', 123_456);
    const merged = all.map(item => result.grns.find(updated => updated.id === item.id) ?? item);
    expect(amountOwedToSupplier(merged, 'sup-001')).toBe(before - 123_456);
  });
});
