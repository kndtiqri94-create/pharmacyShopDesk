import { PayrollTaxSlab } from '../models/domain/payroll-settings.model';
import { divideRoundHalfUp } from './money.util';

const RATE_SCALE = 100;
const PERCENT_DENOMINATOR = 100 * RATE_SCALE;

export function percentScaled(rate: number): number {
  return Number.isFinite(rate) && rate > 0 ? Math.round(rate * RATE_SCALE) : 0;
}

export function percentOfCents(cents: number, rate: number): number {
  return divideRoundHalfUp(Math.max(0, cents) * percentScaled(rate), PERCENT_DENOMINATOR);
}

function sortedSlabs(slabs: readonly PayrollTaxSlab[]): PayrollTaxSlab[] {
  return [...slabs].sort((first, second) => {
    if (first.upToCents === second.upToCents) return 0;
    if (first.upToCents === null) return 1;
    if (second.upToCents === null) return -1;
    return first.upToCents - second.upToCents;
  });
}

export function calculatePayeeTax(grossCents: number, slabs: readonly PayrollTaxSlab[]): number {
  if (!Number.isFinite(grossCents) || grossCents <= 0) return 0;
  let lower = 0;
  let scaledTax = 0;
  for (const slab of sortedSlabs(slabs)) {
    const upper = slab.upToCents ?? Number.POSITIVE_INFINITY;
    if (grossCents > lower) {
      scaledTax += (Math.min(grossCents, upper) - lower) * percentScaled(slab.rate);
    }
    if (grossCents <= upper) break;
    lower = upper;
  }
  return divideRoundHalfUp(scaledTax, PERCENT_DENOMINATOR);
}
