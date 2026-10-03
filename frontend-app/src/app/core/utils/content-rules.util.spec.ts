import { hasNoExclamation, isValidButtonLabel } from './content-rules.util';

describe('content-rules.util', () => {
  it('accepts verb-led sentence-case labels', () => {
    for (const label of ['Log in', 'Receive stock', 'Create PO', 'Save product']) {
      expect(isValidButtonLabel(label)).withContext(label).toBeTrue();
    }
  });

  it('rejects Submit, OK, title case and exclamation marks', () => {
    for (const label of ['Submit', 'ok', 'Receive Stock', 'Save it!', 'save product', '']) {
      expect(isValidButtonLabel(label)).withContext(label).toBeFalse();
    }
  });

  it('detects exclamation marks in copy', () => {
    expect(hasNoExclamation('Welcome back')).toBeTrue();
    expect(hasNoExclamation('Welcome back!')).toBeFalse();
  });
});
