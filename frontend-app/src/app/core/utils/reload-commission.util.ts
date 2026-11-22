export const RELOAD_COMMISSION_RATE = 0.025;
export const BILL_SERVICE_FEE_CENTS = 2500;
export const FLOAT_FULL_CENTS = 2_000_000;

const COMMISSION_PER_MILLE = 25;
const HALF_MILLE = 500;
const MILLE = 1000;

function isPositiveCents(amountCents: number): boolean {
  return Number.isSafeInteger(amountCents) && amountCents > 0;
}

export function commissionCents(amountCents: number): number {
  if (!isPositiveCents(amountCents)) return 0;
  return Math.floor((amountCents * COMMISSION_PER_MILLE + HALF_MILLE) / MILLE);
}

export function customerPaysCents(amountCents: number): number {
  return isPositiveCents(amountCents) ? amountCents : 0;
}

export function billTotalCents(amountCents: number): number {
  return isPositiveCents(amountCents) ? amountCents + BILL_SERVICE_FEE_CENTS : 0;
}
