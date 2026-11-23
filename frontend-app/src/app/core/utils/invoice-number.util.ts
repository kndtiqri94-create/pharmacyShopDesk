import { currentDeviceCode } from './device-identity.util';

const INVOICE_PREFIX = 'INV-';
const INVOICE_DIGITS = 4;
const HOLD_PREFIX = 'H-';
const HOLD_DIGITS = 3;

export interface ParsedInvoiceNumber {
  deviceCode: string | null;
  sequence: number;
}

function highestSuffix(values: readonly string[], prefix: string): number {
  return values
    .filter(value => value.startsWith(prefix))
    .map(value => Number(value.slice(prefix.length)))
    .filter(Number.isInteger)
    .reduce((highest, value) => Math.max(highest, value), 0);
}

function parseSequence(text: string, digits: number): number | null {
  if (text.length !== digits) return null;
  const sequence = Number(text);
  return Number.isInteger(sequence) ? sequence : null;
}

function parseNumber(value: string, prefix: string, digits: number): ParsedInvoiceNumber | null {
  if (!value.startsWith(prefix)) return null;
  const parts = value.slice(prefix.length).split('-');
  if (parts.length === 1) {
    const sequence = parseSequence(parts[0], digits);
    return sequence === null ? null : { deviceCode: null, sequence };
  }
  if (parts.length !== 2 || parts[0].length < 2 || parts[0].length > 4) return null;
  const sequence = parseSequence(parts[1], digits);
  return sequence === null ? null : { deviceCode: parts[0], sequence };
}

function sequenceFor(value: string, prefix: string, digits: number, deviceCode: string | null) {
  const legacy = highestSuffix([value], prefix);
  const parsed = parseNumber(value, prefix, digits);
  const own = parsed !== null && parsed.deviceCode === deviceCode ? parsed.sequence : 0;
  return Math.max(legacy, own);
}

function highestFor(
  values: readonly string[],
  prefix: string,
  digits: number,
  deviceCode: string | null
): number {
  return values.reduce(
    (highest, value) => Math.max(highest, sequenceFor(value, prefix, digits, deviceCode)),
    0
  );
}

function format(prefix: string, digits: number, sequence: number, deviceCode: string | null) {
  const stem = deviceCode === null ? prefix : `${prefix}${deviceCode}-`;
  return `${stem}${String(sequence).padStart(digits, '0')}`;
}

export function parseInvoiceNumber(value: string): ParsedInvoiceNumber | null {
  return parseNumber(value, INVOICE_PREFIX, INVOICE_DIGITS);
}

export function invoiceSequence(invoiceNo: string): number {
  return sequenceFor(invoiceNo, INVOICE_PREFIX, INVOICE_DIGITS, currentDeviceCode());
}

export function formatInvoiceNumber(sequence: number, deviceCode: string | null = null): string {
  return format(INVOICE_PREFIX, INVOICE_DIGITS, sequence, deviceCode ?? currentDeviceCode());
}

export function nextInvoiceNumber(existing: readonly string[], floor = 0): string {
  const deviceCode = currentDeviceCode();
  const highest = Math.max(highestFor(existing, INVOICE_PREFIX, INVOICE_DIGITS, deviceCode), floor);
  return format(INVOICE_PREFIX, INVOICE_DIGITS, highest + 1, deviceCode);
}

export function isInvoiceNumber(value: string): boolean {
  return parseInvoiceNumber(value) !== null;
}

export function nextHoldNumber(existing: readonly string[]): string {
  const deviceCode = currentDeviceCode();
  return format(
    HOLD_PREFIX,
    HOLD_DIGITS,
    highestFor(existing, HOLD_PREFIX, HOLD_DIGITS, deviceCode) + 1,
    deviceCode
  );
}
