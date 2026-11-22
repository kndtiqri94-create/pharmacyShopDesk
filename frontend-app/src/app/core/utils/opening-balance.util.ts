import { parseRequiredAmountCents } from './pos-validation.util';

export const OPENING_ERROR_MESSAGE =
  'Enter the opening balance as zero or more, like 5000 or 5000.50.';

export type OpeningParse = { ok: true; cents: number } | { ok: false; message: string };

export function parseOpeningBalance(text: string): OpeningParse {
  const cents = parseRequiredAmountCents(text);
  return cents === null ? { ok: false, message: OPENING_ERROR_MESSAGE } : { ok: true, cents };
}

export function openingChanged(oldCents: number, newCents: number): boolean {
  return oldCents !== newCents;
}
