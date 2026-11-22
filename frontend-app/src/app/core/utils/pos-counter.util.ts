import { parseAmountCents, parseRequiredAmountCents } from './pos-validation.util';

export const COUNTER_NOTE_MAX_LENGTH = 200;
export const COUNTED_ERROR_MESSAGE = 'Enter the cash you counted, like 12500 or 12500.50.';

export type CounterOutcome = 'OVER' | 'SHORT' | 'BALANCED';

export const COUNTER_OUTCOME_LABELS: Record<CounterOutcome, string> = {
  OVER: 'Over',
  SHORT: 'Short',
  BALANCED: 'Balanced',
};

export type CountedParse = { ok: true; cents: number } | { ok: false; message: string };

export function counterDifferenceCents(countedCents: number, expectedCents: number): number {
  return countedCents - expectedCents;
}

export function counterOutcome(differenceCents: number): CounterOutcome {
  if (differenceCents > 0) return 'OVER';
  return differenceCents < 0 ? 'SHORT' : 'BALANCED';
}

export function parseCountedCents(text: string): CountedParse {
  const cents = parseRequiredAmountCents(text);
  return cents === null ? { ok: false, message: COUNTED_ERROR_MESSAGE } : { ok: true, cents };
}

export function cleanCounterNote(text: string): string {
  return text.trim().slice(0, COUNTER_NOTE_MAX_LENGTH);
}

export const HANDOVER_ERROR_MESSAGE =
  'Enter the handover like 5000 or 5000.50, or leave it empty for none.';
export const HANDOVER_ABOVE_COUNTED_MESSAGE =
  'The handover cannot be more than the cash you counted.';
export const SUPERVISOR_REQUIRED_MESSAGE = 'Choose the supervisor who received the cash.';
export const BROUGHT_FORWARD_ERROR_MESSAGE = 'Enter the balance like 5000 or 5000.50.';
export const BROUGHT_FORWARD_TOO_HIGH_MESSAGE =
  'The balance brought forward plus the handover cannot be more than the cash you counted.';

export type CounterCloseField = 'counted' | 'handover' | 'supervisor' | 'broughtForward';

export interface CounterCloseText {
  countedText: string;
  handoverText: string;
  supervisorUserId: string | null;
  broughtForwardText: string | null;
}

export interface CounterCloseAmounts {
  countedCents: number;
  handoverCents: number;
  broughtForwardCents: number;
  unaccountedCents: number;
  supervisorUserId: string | null;
}

export type CounterCloseValidation =
  | { ok: true; amounts: CounterCloseAmounts }
  | { ok: false; field: CounterCloseField; message: string };

export function parseHandoverCents(text: string): CountedParse {
  if (text.trim().length === 0) return { ok: true, cents: 0 };
  const cents = parseRequiredAmountCents(text);
  return cents === null ? { ok: false, message: HANDOVER_ERROR_MESSAGE } : { ok: true, cents };
}

export function validateHandover(countedCents: number, handoverText: string): CountedParse {
  const parsed = parseHandoverCents(handoverText);
  if (parsed.ok && parsed.cents > countedCents) {
    return { ok: false, message: HANDOVER_ABOVE_COUNTED_MESSAGE };
  }
  return parsed;
}

export function defaultBroughtForwardCents(countedCents: number, handoverCents: number): number {
  return Math.max(0, countedCents - handoverCents);
}

export function validateBroughtForward(
  countedCents: number,
  handoverCents: number,
  broughtForwardText: string | null
): CountedParse {
  if (broughtForwardText === null) {
    return { ok: true, cents: defaultBroughtForwardCents(countedCents, handoverCents) };
  }
  const cents = parseAmountCents(broughtForwardText);
  if (cents === null) return { ok: false, message: BROUGHT_FORWARD_ERROR_MESSAGE };
  if (cents + handoverCents > countedCents) {
    return { ok: false, message: BROUGHT_FORWARD_TOO_HIGH_MESSAGE };
  }
  return { ok: true, cents };
}

export function unaccountedCents(
  countedCents: number,
  handoverCents: number,
  broughtForwardCents: number
): number {
  return Math.max(0, countedCents - handoverCents - broughtForwardCents);
}

export function isSupervisorRequired(handoverCents: number): boolean {
  return handoverCents > 0;
}

export function canComplete(countedText: string): boolean {
  return parseCountedCents(countedText).ok;
}

function refuse(field: CounterCloseField, message: string): CounterCloseValidation {
  return { ok: false, field, message };
}

export function validateCounterClose(input: CounterCloseText): CounterCloseValidation {
  const counted = parseCountedCents(input.countedText);
  if (!counted.ok) return refuse('counted', counted.message);
  const handover = validateHandover(counted.cents, input.handoverText);
  if (!handover.ok) return refuse('handover', handover.message);
  const broughtForward = validateBroughtForward(
    counted.cents,
    handover.cents,
    input.broughtForwardText
  );
  if (!broughtForward.ok) return refuse('broughtForward', broughtForward.message);
  const supervisorUserId = input.supervisorUserId?.trim() || null;
  if (isSupervisorRequired(handover.cents) && supervisorUserId === null) {
    return refuse('supervisor', SUPERVISOR_REQUIRED_MESSAGE);
  }
  return {
    ok: true,
    amounts: {
      countedCents: counted.cents,
      handoverCents: handover.cents,
      broughtForwardCents: broughtForward.cents,
      unaccountedCents: unaccountedCents(counted.cents, handover.cents, broughtForward.cents),
      supervisorUserId: isSupervisorRequired(handover.cents) ? supervisorUserId : null,
    },
  };
}
