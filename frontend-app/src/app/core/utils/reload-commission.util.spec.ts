import {
  BILL_SERVICE_FEE_CENTS,
  FLOAT_FULL_CENTS,
  RELOAD_COMMISSION_RATE,
  billTotalCents,
  commissionCents,
  customerPaysCents,
} from './reload-commission.util';

describe('reload commission', () => {
  it('uses 2.5 percent, a Rs. 25.00 bill fee and a Rs. 20,000 full float', () => {
    expect(RELOAD_COMMISSION_RATE).toBe(0.025);
    expect(BILL_SERVICE_FEE_CENTS).toBe(2500);
    expect(FLOAT_FULL_CENTS).toBe(2_000_000);
  });

  it('earns Rs. 12.50 on Rs. 500 and the customer pays Rs. 500.00', () => {
    expect(commissionCents(50_000)).toBe(1250);
    expect(customerPaysCents(50_000)).toBe(50_000);
  });

  it('earns the expected commission on every chip amount', () => {
    expect([5000, 10_000, 20_000, 50_000, 100_000].map(commissionCents)).toEqual([
      125, 250, 500, 1250, 2500,
    ]);
  });

  it('rounds half up to a whole cent', () => {
    expect(commissionCents(1001)).toBe(25);
    expect(commissionCents(1020)).toBe(26);
    expect(commissionCents(1)).toBe(0);
    expect(commissionCents(20)).toBe(1);
    expect(commissionCents(19)).toBe(0);
  });

  it('is zero for no amount, zero, negative and invalid amounts', () => {
    for (const amount of [0, -5000, Number.NaN, Number.POSITIVE_INFINITY, 10.5]) {
      expect(commissionCents(amount)).withContext(String(amount)).toBe(0);
      expect(customerPaysCents(amount)).withContext(String(amount)).toBe(0);
      expect(billTotalCents(amount)).withContext(String(amount)).toBe(0);
    }
  });

  it('adds the fixed fee to a bill amount', () => {
    expect(billTotalCents(100_000)).toBe(102_500);
  });
});
