import { setCurrentDeviceCode } from './device-identity.util';
import {
  formatInvoiceNumber,
  invoiceSequence,
  isInvoiceNumber,
  nextHoldNumber,
  nextInvoiceNumber,
  parseInvoiceNumber,
} from './invoice-number.util';

describe('invoice numbers', () => {
  it('starts at INV-0001 and goes up by one', () => {
    expect(nextInvoiceNumber([])).toBe('INV-0001');
    expect(nextInvoiceNumber(['INV-0001', 'INV-0002'])).toBe('INV-0003');
  });

  it('goes after the highest number even when the list is out of order', () => {
    expect(nextInvoiceNumber(['INV-0009', 'INV-0002'])).toBe('INV-0010');
  });

  it('ignores values that are not invoice numbers', () => {
    expect(nextInvoiceNumber(['GRN-0100', 'INV-x', ''])).toBe('INV-0001');
  });

  it('never goes below the floor so a reserved number is not reused', () => {
    expect(nextInvoiceNumber(['INV-0002'], 5)).toBe('INV-0006');
    expect(nextInvoiceNumber(['INV-0007'], 5)).toBe('INV-0008');
  });

  it('formats and reads a sequence', () => {
    expect(formatInvoiceNumber(12)).toBe('INV-0012');
    expect(invoiceSequence('INV-0012')).toBe(12);
    expect(invoiceSequence('nope')).toBe(0);
  });

  it('recognises a well formed invoice number only', () => {
    expect(isInvoiceNumber('INV-0001')).toBeTrue();
    expect(isInvoiceNumber('INV-1')).toBeFalse();
    expect(isInvoiceNumber('INV-00x1')).toBeFalse();
    expect(isInvoiceNumber('PO-0001')).toBeFalse();
    expect(isInvoiceNumber('')).toBeFalse();
  });

  it('numbers held bills from H-001', () => {
    expect(nextHoldNumber([])).toBe('H-001');
    expect(nextHoldNumber(['H-001', 'H-004'])).toBe('H-005');
  });
});

describe('invoice numbers with a device code', () => {
  afterEach(() => setCurrentDeviceCode(null));

  it('puts the device code in the number and numbers on from there', () => {
    setCurrentDeviceCode('K7M');
    expect(nextInvoiceNumber([])).toBe('INV-K7M-0001');
    expect(nextInvoiceNumber(['INV-K7M-0001', 'INV-K7M-0002'])).toBe('INV-K7M-0003');
    expect(formatInvoiceNumber(12)).toBe('INV-K7M-0012');
  });

  it('never lets two devices issue the same number', () => {
    setCurrentDeviceCode('K7M');
    const first = nextInvoiceNumber([]);
    setCurrentDeviceCode('T1');
    const second = nextInvoiceNumber([]);
    expect(first).not.toBe(second);
  });

  it('ignores the sequence of another device but keeps older plain numbers', () => {
    setCurrentDeviceCode('K7M');
    expect(nextInvoiceNumber(['INV-T1-0009'])).toBe('INV-K7M-0001');
    expect(nextInvoiceNumber(['INV-0004'])).toBe('INV-K7M-0005');
    expect(invoiceSequence('INV-K7M-0042')).toBe(42);
    expect(invoiceSequence('INV-T1-0042')).toBe(0);
    expect(invoiceSequence('INV-0042')).toBe(42);
  });

  it('accepts both forms as invoice numbers', () => {
    expect(isInvoiceNumber('INV-0001')).toBeTrue();
    expect(isInvoiceNumber('INV-K7M-0001')).toBeTrue();
    expect(isInvoiceNumber('INV-K7M-1')).toBeFalse();
    expect(isInvoiceNumber('INV-K7M-0001-9')).toBeFalse();
    expect(parseInvoiceNumber('INV-K7M-0001')).toEqual({ deviceCode: 'K7M', sequence: 1 });
    expect(parseInvoiceNumber('INV-0001')).toEqual({ deviceCode: null, sequence: 1 });
  });

  it('gives held bill numbers the device code as well', () => {
    setCurrentDeviceCode('K7M');
    expect(nextHoldNumber([])).toBe('H-K7M-001');
    expect(nextHoldNumber(['H-K7M-001', 'H-004'])).toBe('H-K7M-005');
  });
});
