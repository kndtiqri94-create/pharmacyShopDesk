import {
  formatInvoiceNumber,
  invoiceSequence,
  isInvoiceNumber,
  nextHoldNumber,
  nextInvoiceNumber,
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
