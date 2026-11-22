import { nextDocumentNumber, nextRecordId } from './document-number.util';

describe('document-number.util', () => {
  it('continues from the highest GRN number', () => {
    expect(nextDocumentNumber('GRN', ['GRN-0208', 'GRN-0211', 'GRN-0207'])).toBe('GRN-0212');
  });

  it('continues from the highest PO number and ignores other prefixes', () => {
    expect(nextDocumentNumber('PO', ['PO-0149', 'GRN-9999', 'PO-0145'])).toBe('PO-0150');
  });

  it('starts at one when there are no numbers', () => {
    expect(nextDocumentNumber('GRN', [])).toBe('GRN-0001');
  });

  it('ignores numbers it cannot read', () => {
    expect(nextDocumentNumber('PO', ['PO-abc', 'PO-0003'])).toBe('PO-0004');
  });

  it('builds the next record id', () => {
    expect(nextRecordId('grn', ['grn-001', 'grn-005'])).toBe('grn-006');
    expect(nextRecordId('bat', [])).toBe('bat-001');
  });
});
