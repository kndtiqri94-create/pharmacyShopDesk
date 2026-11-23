import { reasonText } from './sync-reason-text';

describe('reasonText', () => {
  it('turns known codes into plain words without technical terms', () => {
    const codes = ['validation_error', 'duplicate_sku', 'duplicate_invoice_no', 'immutable_record'];
    for (const code of codes) {
      const text = reasonText(code);
      expect(text).not.toContain('_');
      expect(text.endsWith('.')).toBeTrue();
    }
    expect(reasonText('duplicate_invoice_no')).toBe(
      'Another sale already has this invoice number.'
    );
  });

  it('uses one generic sentence for anything unknown or missing', () => {
    expect(reasonText('totally_new_code')).toBe('The central record could not accept this change.');
    expect(reasonText(undefined)).toBe('The central record could not accept this change.');
  });
});
