import { PAYROLL_SETTINGS_SEED } from '../services/data/in-memory/seed/payroll.seed';
import { divideRoundHalfUp } from './money.util';
import { calculatePayeeTax, percentOfCents } from './payroll-tax.util';

const SLABS = PAYROLL_SETTINGS_SEED.taxSlabs;

describe('divideRoundHalfUp', () => {
  it('rounds exact halves up and everything else to nearest', () => {
    expect(divideRoundHalfUp(5, 10)).toBe(1);
    expect(divideRoundHalfUp(4, 10)).toBe(0);
    expect(divideRoundHalfUp(15, 10)).toBe(2);
    expect(divideRoundHalfUp(14, 10)).toBe(1);
    expect(divideRoundHalfUp(98760, 100)).toBe(988);
  });

  it('returns 0 for zero, negative, non finite or bad denominators', () => {
    expect(divideRoundHalfUp(0, 5)).toBe(0);
    expect(divideRoundHalfUp(-3, 2)).toBe(0);
    expect(divideRoundHalfUp(Number.NaN, 2)).toBe(0);
    expect(divideRoundHalfUp(1, 0)).toBe(0);
  });
});

describe('percentOfCents', () => {
  it('applies a percentage in integer cents with half up rounding', () => {
    expect(percentOfCents(12345, 8)).toBe(988);
    expect(percentOfCents(4, 12.5)).toBe(1);
    expect(percentOfCents(3, 12.5)).toBe(0);
    expect(percentOfCents(10000000, 2)).toBe(200000);
  });

  it('gives 0 for zero, negative or invalid rates and amounts', () => {
    expect(percentOfCents(1000, 0)).toBe(0);
    expect(percentOfCents(1000, -5)).toBe(0);
    expect(percentOfCents(1000, Number.NaN)).toBe(0);
    expect(percentOfCents(-1000, 8)).toBe(0);
  });
});

describe('calculatePayeeTax', () => {
  it('is zero for zero, negative and invalid gross', () => {
    expect(calculatePayeeTax(0, SLABS)).toBe(0);
    expect(calculatePayeeTax(-100, SLABS)).toBe(0);
    expect(calculatePayeeTax(Number.NaN, SLABS)).toBe(0);
  });

  it('is zero at or below the first band edge', () => {
    expect(calculatePayeeTax(1, SLABS)).toBe(0);
    expect(calculatePayeeTax(10000000, SLABS)).toBe(0);
  });

  it('taxes only the part above each edge at that band rate', () => {
    expect(calculatePayeeTax(10000001, SLABS)).toBe(0);
    expect(calculatePayeeTax(10000100, SLABS)).toBe(6);
    expect(calculatePayeeTax(15000000, SLABS)).toBe(300000);
    expect(calculatePayeeTax(15000100, SLABS)).toBe(300012);
    expect(calculatePayeeTax(20000000, SLABS)).toBe(900000);
    expect(calculatePayeeTax(20000100, SLABS)).toBe(900018);
  });

  it('handles a very high gross in the open top band', () => {
    expect(calculatePayeeTax(30000000, SLABS)).toBe(2700000);
    expect(calculatePayeeTax(100000000000, SLABS)).toBe(17997300000);
  });

  it('does not depend on the order of the slabs', () => {
    const shuffled = [SLABS[3], SLABS[1], SLABS[0], SLABS[2]];
    expect(calculatePayeeTax(30000000, shuffled)).toBe(2700000);
  });

  it('rounds the total half up once', () => {
    const slabs = [{ upToCents: null, rate: 12.5 }];
    expect(calculatePayeeTax(4, slabs)).toBe(1);
    expect(calculatePayeeTax(12, slabs)).toBe(2);
    expect(calculatePayeeTax(3, slabs)).toBe(0);
  });

  it('follows changed slab values', () => {
    expect(calculatePayeeTax(1000, [{ upToCents: null, rate: 10 }])).toBe(100);
    expect(calculatePayeeTax(1000, [])).toBe(0);
  });
});
