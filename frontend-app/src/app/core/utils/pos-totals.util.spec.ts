import {
  billDiscountCents,
  billDiscountPercent,
  computeBillTotals,
  lineDiscountCents,
  lineTotalCents,
  percentFromCents,
} from './pos-totals.util';

const NO_PAYMENT = { cashCents: 0, cardCents: 0, onlineCents: 0, creditSelected: false };
const PERCENT_ZERO = { mode: 'PERCENT', percent: 0 } as const;
const HUNDRED_RUPEES = [{ unitPriceCents: 10_000, quantity: 1, discountPercent: 0 }];

describe('pos totals', () => {
  describe('line totals', () => {
    it('multiplies price by quantity', () => {
      expect(lineTotalCents({ unitPriceCents: 250, quantity: 4, discountPercent: 0 })).toBe(1000);
    });

    it('takes the line discount off the gross and rounds half up', () => {
      expect(lineDiscountCents(1000, 10)).toBe(100);
      expect(lineDiscountCents(1005, 10)).toBe(101);
      expect(lineDiscountCents(1004, 10)).toBe(100);
      expect(lineTotalCents({ unitPriceCents: 1005, quantity: 1, discountPercent: 10 })).toBe(904);
    });

    it('supports two decimal places in the percentage', () => {
      expect(lineDiscountCents(10_000, 12.5)).toBe(1250);
      expect(lineDiscountCents(10_000, 0.01)).toBe(1);
    });

    it('gives no discount at zero and the whole line at 100 percent', () => {
      expect(lineDiscountCents(999, 0)).toBe(0);
      expect(lineTotalCents({ unitPriceCents: 999, quantity: 1, discountPercent: 100 })).toBe(0);
    });
  });

  describe('linked bill discount', () => {
    it('works out Rs. from a percentage and percentage from Rs.', () => {
      expect(billDiscountCents(20_000, { mode: 'PERCENT', percent: 10 })).toBe(2000);
      expect(billDiscountCents(20_000, { mode: 'AMOUNT', cents: 2000 })).toBe(2000);
      expect(percentFromCents(2000, 20_000)).toBe(10);
      expect(billDiscountPercent(20_000, { mode: 'AMOUNT', cents: 2000 })).toBe(10);
    });

    it('rounds the percentage to two decimals half up', () => {
      expect(percentFromCents(1, 3)).toBe(33.33);
      expect(percentFromCents(5000, 33_300)).toBe(15.02);
    });

    it('never goes below zero or above the sub total', () => {
      expect(billDiscountCents(1000, { mode: 'AMOUNT', cents: 5000 })).toBe(1000);
      expect(billDiscountCents(1000, { mode: 'AMOUNT', cents: -5 })).toBe(0);
      expect(billDiscountCents(0, { mode: 'AMOUNT', cents: 10 })).toBe(0);
      expect(percentFromCents(10, 0)).toBe(0);
    });
  });

  describe('bill totals', () => {
    const lines = [
      { unitPriceCents: 1000, quantity: 2, discountPercent: 0 },
      { unitPriceCents: 500, quantity: 1, discountPercent: 10 },
    ];

    it('adds the items, sub total, discount and total', () => {
      const totals = computeBillTotals(lines, { mode: 'PERCENT', percent: 10 }, NO_PAYMENT);
      expect(totals.itemCount).toBe(2);
      expect(totals.subTotalCents).toBe(2450);
      expect(totals.discountCents).toBe(245);
      expect(totals.totalCents).toBe(2205);
      expect(totals.paidCents).toBe(0);
    });

    it('is empty and zero for no lines', () => {
      const totals = computeBillTotals([], PERCENT_ZERO, NO_PAYMENT);
      expect(totals.totalCents).toBe(0);
      expect(totals.balanceKind).toBe('SETTLED');
    });

    it('treats Cash + Card + Online as paid and ignores credit', () => {
      const totals = computeBillTotals(HUNDRED_RUPEES, PERCENT_ZERO, {
        cashCents: 6000,
        cardCents: 4000,
        onlineCents: 0,
        creditSelected: false,
      });
      expect(totals.paidCents).toBe(10_000);
      expect(totals.balanceKind).toBe('SETTLED');
      expect(totals.creditCents).toBe(0);
    });

    it('shows Change when cash is more than the amount due', () => {
      const totals = computeBillTotals(HUNDRED_RUPEES, PERCENT_ZERO, {
        cashCents: 12_000,
        cardCents: 0,
        onlineCents: 0,
        creditSelected: false,
      });
      expect(totals.balanceKind).toBe('CHANGE');
      expect(totals.changeCents).toBe(2000);
    });

    it('shows Credit due for the unpaid part when Credit is chosen', () => {
      const totals = computeBillTotals(HUNDRED_RUPEES, PERCENT_ZERO, {
        cashCents: 3000,
        cardCents: 0,
        onlineCents: 0,
        creditSelected: true,
      });
      expect(totals.balanceKind).toBe('CREDIT_DUE');
      expect(totals.creditCents).toBe(7000);
      expect(totals.paidCents).toBe(3000);
    });

    it('shows Due when nothing covers the rest', () => {
      const totals = computeBillTotals(HUNDRED_RUPEES, PERCENT_ZERO, {
        cashCents: 3000,
        cardCents: 0,
        onlineCents: 0,
        creditSelected: false,
      });
      expect(totals.balanceKind).toBe('DUE');
      expect(totals.balanceCents).toBe(7000);
      expect(totals.creditCents).toBe(0);
    });

    it('has no credit when Credit is chosen but the bill is already paid', () => {
      const totals = computeBillTotals(HUNDRED_RUPEES, PERCENT_ZERO, {
        cashCents: 10_000,
        cardCents: 0,
        onlineCents: 0,
        creditSelected: true,
      });
      expect(totals.creditCents).toBe(0);
      expect(totals.balanceKind).toBe('SETTLED');
    });
  });
});
