import { PaymentStatus } from '../models/enums/payment-status.enum';
import { computeGrnTotals, derivePaymentStatus, grnLineTotalCents } from './grn-totals.util';

describe('grn-totals.util', () => {
  const lines = [
    { receivedQuantity: 1000, freeQuantity: 100, costCents: 180 },
    { receivedQuantity: 500, freeQuantity: 0, costCents: 300 },
  ];

  it('multiplies received quantity by cost and adds nothing for free units', () => {
    expect(grnLineTotalCents(lines[0])).toBe(180_000);
  });

  it('counts lines and units including free units, with the amount excluding them', () => {
    const totals = computeGrnTotals(lines, 0, 0);
    expect(totals.lineCount).toBe(2);
    expect(totals.unitCount).toBe(1600);
    expect(totals.subTotalCents).toBe(330_000);
    expect(totals.totalCents).toBe(330_000);
  });

  it('takes the discount off the total and never goes below zero', () => {
    expect(computeGrnTotals(lines, 30_000, 0).totalCents).toBe(300_000);
    expect(computeGrnTotals(lines, 999_999_999, 0).totalCents).toBe(0);
  });

  it('works out the balance after payment', () => {
    const totals = computeGrnTotals(lines, 30_000, 100_000);
    expect(totals.balanceCents).toBe(200_000);
    expect(computeGrnTotals(lines, 0, 999_999_999).balanceCents).toBe(0);
  });

  it('derives Paid, Part paid and Unpaid', () => {
    expect(derivePaymentStatus(1000, 1000)).toBe(PaymentStatus.PAID);
    expect(derivePaymentStatus(1000, 400)).toBe(PaymentStatus.PART_PAID);
    expect(derivePaymentStatus(1000, 0)).toBe(PaymentStatus.UNPAID);
    expect(derivePaymentStatus(0, 0)).toBe(PaymentStatus.PAID);
  });
});
