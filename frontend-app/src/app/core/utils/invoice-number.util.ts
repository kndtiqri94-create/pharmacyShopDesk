const INVOICE_PREFIX = 'INV-';
const INVOICE_DIGITS = 4;
const HOLD_PREFIX = 'H-';
const HOLD_DIGITS = 3;

function highestSuffix(values: readonly string[], prefix: string): number {
  return values
    .filter(value => value.startsWith(prefix))
    .map(value => Number(value.slice(prefix.length)))
    .filter(Number.isInteger)
    .reduce((highest, value) => Math.max(highest, value), 0);
}

export function invoiceSequence(invoiceNo: string): number {
  return highestSuffix([invoiceNo], INVOICE_PREFIX);
}

export function formatInvoiceNumber(sequence: number): string {
  return `${INVOICE_PREFIX}${String(sequence).padStart(INVOICE_DIGITS, '0')}`;
}

export function nextInvoiceNumber(existing: readonly string[], floor = 0): string {
  return formatInvoiceNumber(Math.max(highestSuffix(existing, INVOICE_PREFIX), floor) + 1);
}

export function isInvoiceNumber(value: string): boolean {
  return (
    value.startsWith(INVOICE_PREFIX) &&
    value.length === INVOICE_PREFIX.length + INVOICE_DIGITS &&
    Number.isInteger(Number(value.slice(INVOICE_PREFIX.length)))
  );
}

export function nextHoldNumber(existing: readonly string[]): string {
  return `${HOLD_PREFIX}${String(highestSuffix(existing, HOLD_PREFIX) + 1).padStart(HOLD_DIGITS, '0')}`;
}
