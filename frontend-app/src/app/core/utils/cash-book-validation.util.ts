import { addDays, daysBetween, isIsoDate } from './date.util';
import { parseRequiredAmountCents } from './pos-validation.util';

export const MAX_RANGE_DAYS = 92;
export const MAX_ADJUSTMENT_NOTE_LENGTH = 200;
export const COUNTED_ERROR_MESSAGE =
  'Enter the counted cash as zero or more, like 5000 or 5000.50.';
export const ADJUSTMENT_AMOUNT_MESSAGE =
  'Enter the adjustment as an amount that is not zero, like 250, 250.50 or -250.';
export const ADJUSTMENT_NOTE_REQUIRED_MESSAGE = 'Add a note that says why you are adjusting.';
export const RANGE_ERROR_MESSAGE = `Choose a valid date range: From on or before To, today at the latest, and at most ${MAX_RANGE_DAYS} days.`;

export type RangeCheck = { ok: true } | { ok: false; message: string };
export type CountedParse = { ok: true; cents: number } | { ok: false; message: string };
export type AdjustmentErrors = { amount?: string; note?: string };
export type AdjustmentParse =
  { ok: true; signedCents: number; note: string } | { ok: false; errors: AdjustmentErrors };

export function validateDateRange(from: string, to: string, today: string): RangeCheck {
  const valid = isIsoDate(from) && isIsoDate(to) && from <= to && to <= today;
  const spanOk = valid && daysBetween(from, to) < MAX_RANGE_DAYS;
  return spanOk ? { ok: true } : { ok: false, message: RANGE_ERROR_MESSAGE };
}

export function datesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let day = from; day <= to && dates.length < MAX_RANGE_DAYS; day = addDays(day, 1)) {
    dates.push(day);
  }
  return dates;
}

export function parseCountedAmount(text: string): CountedParse {
  const cents = parseRequiredAmountCents(text);
  return cents === null ? { ok: false, message: COUNTED_ERROR_MESSAGE } : { ok: true, cents };
}

function parseSignedCents(text: string): number | null {
  const trimmed = text.trim();
  const negative = trimmed.startsWith('-');
  const unsigned = negative || trimmed.startsWith('+') ? trimmed.slice(1) : trimmed;
  const cents = parseRequiredAmountCents(unsigned);
  if (cents === null || cents === 0) return null;
  return negative ? -cents : cents;
}

export function parseAdjustment(amountText: string, noteText: string): AdjustmentParse {
  const errors: AdjustmentErrors = {};
  const signedCents = parseSignedCents(amountText);
  const note = noteText.trim();
  if (signedCents === null) errors.amount = ADJUSTMENT_AMOUNT_MESSAGE;
  if (note.length === 0) errors.note = ADJUSTMENT_NOTE_REQUIRED_MESSAGE;
  else if (note.length > MAX_ADJUSTMENT_NOTE_LENGTH) {
    errors.note = `Keep the note to ${MAX_ADJUSTMENT_NOTE_LENGTH} characters or fewer.`;
  }
  if (signedCents === null || errors.note !== undefined) return { ok: false, errors };
  return { ok: true, signedCents, note };
}
