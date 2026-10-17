import {
  ReloadFormInput,
  formatMobileReference,
  isValidTopUpCents,
  validateBill,
  validateReload,
  validateTopUp,
} from './reload-validation.util';

describe('validateReload', () => {
  const valid: ReloadFormInput = {
    operator: 'Dialog',
    mobile: '77 123 4567',
    customerName: '',
    amount: '500',
  };
  const AVAILABLE = 620_000;

  it('accepts valid details and converts the amount to cents once', () => {
    const result = validateReload({ ...valid, amount: '500.50' }, AVAILABLE);
    expect(result.errors).toEqual({});
    expect(result.firstErrorField).toBeNull();
    expect(result.values).toEqual({
      operator: 'Dialog',
      reference: '077 123 4567',
      amountCents: 50_050,
    });
  });

  it('strips typed spaces from the number and groups it like the sample rows', () => {
    expect(validateReload({ ...valid, mobile: '771234567' }, AVAILABLE).values?.reference).toBe(
      '077 123 4567'
    );
    expect(formatMobileReference('712345678')).toBe('071 234 5678');
  });

  it('lets the customer name stay empty', () => {
    expect(validateReload({ ...valid, customerName: '   ' }, AVAILABLE).values).not.toBeNull();
  });

  it('asks for an operator', () => {
    for (const operator of ['', 'Telco', 'dialog']) {
      const result = validateReload({ ...valid, operator }, AVAILABLE);
      expect(result.values).withContext(operator).toBeNull();
      expect(result.errors.operator).toBe('Choose the operator');
      expect(result.firstErrorField).toBe('operator');
    }
  });

  it('rejects an empty, short, long or non-digit mobile number', () => {
    for (const mobile of ['', '   ', '1234', '77 123 456', '77 123 45678', '077 123 4567']) {
      const result = validateReload({ ...valid, mobile }, AVAILABLE);
      expect(result.values).withContext(mobile).toBeNull();
      expect(result.errors.mobile).withContext(mobile).toBeDefined();
    }
    expect(validateReload({ ...valid, mobile: '77 abc 4567' }, AVAILABLE).errors.mobile).toBe(
      'Use digits only in the mobile number'
    );
    expect(validateReload({ ...valid, mobile: '+94771234' }, AVAILABLE).values).toBeNull();
  });

  it('rejects an empty, zero, negative, non-numeric, scientific or oversized amount', () => {
    for (const amount of [
      '',
      '  ',
      '0',
      '0.00',
      '-5',
      'abc',
      '1e3',
      '12.345',
      '1,000',
      '6200.01',
    ]) {
      const result = validateReload({ ...valid, amount }, AVAILABLE);
      expect(result.values).withContext(amount).toBeNull();
      expect(result.errors.amount).withContext(amount).toBeDefined();
    }
  });

  it('allows exactly the available float but not a cent more', () => {
    expect(validateReload({ ...valid, amount: '6200' }, AVAILABLE).values?.amountCents).toBe(
      620_000
    );
    expect(validateReload({ ...valid, amount: '6200.01' }, AVAILABLE).errors.amount).toBe(
      'The amount can be at most Rs. 6,200'
    );
  });

  it('allows nothing when the float is empty', () => {
    expect(validateReload(valid, 0).errors.amount).toContain('at most');
    expect(validateReload(valid, -100).values).toBeNull();
  });

  it('rejects a customer name over the limit', () => {
    const result = validateReload({ ...valid, customerName: 'x'.repeat(61) }, AVAILABLE);
    expect(result.errors.customerName).toBe('Customer name must be 60 characters or fewer');
    expect(
      validateReload({ ...valid, customerName: 'x'.repeat(60) }, AVAILABLE).values
    ).not.toBeNull();
  });

  it('points at the first problem in page order', () => {
    const empty = validateReload({ operator: '', mobile: '', customerName: '', amount: '' }, 100);
    expect(empty.firstErrorField).toBe('operator');
    expect(Object.keys(empty.errors)).toEqual(['operator', 'mobile', 'amount']);
    expect(validateReload({ ...valid, mobile: '1', amount: '' }, 100).firstErrorField).toBe(
      'mobile'
    );
    expect(validateReload({ ...valid, amount: '' }, 100).firstErrorField).toBe('amount');
  });
});

describe('validateBill', () => {
  const valid = { provider: 'Electricity (CEB)', account: '0123456789', amount: '1000' };

  it('accepts valid details', () => {
    expect(validateBill(valid).values).toEqual({
      provider: 'Electricity (CEB)',
      account: '0123456789',
      amountCents: 100_000,
    });
  });

  it('trims the account number', () => {
    expect(validateBill({ ...valid, account: '  AB-12  ' }).values?.account).toBe('AB-12');
  });

  it('asks for a provider, an account and an amount, first problem in page order', () => {
    const result = validateBill({ provider: '', account: ' ', amount: '' });
    expect(result.values).toBeNull();
    expect(Object.keys(result.errors)).toEqual(['provider', 'account', 'amount']);
    expect(result.firstErrorField).toBe('provider');
    expect(validateBill({ ...valid, account: '' }).firstErrorField).toBe('account');
    expect(validateBill({ ...valid, amount: '' }).firstErrorField).toBe('amount');
  });

  it('rejects zero, negative, non-numeric and scientific amounts', () => {
    for (const amount of ['0', '-1', 'abc', '1e3', '10.999']) {
      expect(validateBill({ ...valid, amount }).errors.amount)
        .withContext(amount)
        .toBeDefined();
    }
  });

  it('rejects an oversized account number and amount', () => {
    expect(validateBill({ ...valid, account: 'x'.repeat(31) }).errors.account).toBe(
      'Account number must be 30 characters or fewer'
    );
    expect(validateBill({ ...valid, amount: '1000000' }).values).not.toBeNull();
    expect(validateBill({ ...valid, amount: '1000000.01' }).errors.amount).toBe(
      'The amount can be at most Rs. 1,000,000'
    );
  });

  it('rejects a provider that is not offered', () => {
    expect(validateBill({ ...valid, provider: 'Gas' }).errors.provider).toBe('Choose the provider');
  });
});

describe('validateTopUp', () => {
  it('accepts whole rupees up to Rs. 1,000,000', () => {
    expect(validateTopUp('5000')).toEqual({ amountCents: 500_000, error: null });
    expect(validateTopUp(' 1 '.trim())).toEqual({ amountCents: 100, error: null });
    expect(validateTopUp('1000000')).toEqual({ amountCents: 100_000_000, error: null });
  });

  it('rejects empty, zero, negative, decimal, non-numeric and scientific amounts', () => {
    for (const text of ['', '  ', '0', '-5', '10.5', '10.00', 'abc', '1e3', '1,000', '+5']) {
      const result = validateTopUp(text);
      expect(result.amountCents).withContext(text).toBeNull();
      expect(result.error).withContext(text).not.toBeNull();
    }
  });

  it('rejects more than Rs. 1,000,000 and oversized text', () => {
    expect(validateTopUp('1000001')).toEqual({
      amountCents: null,
      error: 'You can add at most Rs. 1,000,000 at once',
    });
    expect(validateTopUp('9'.repeat(40)).amountCents).toBeNull();
  });

  it('says what to fix', () => {
    expect(validateTopUp('').error).toBe('Enter the amount you are adding');
    expect(validateTopUp('0').error).toBe('Enter an amount above zero');
    expect(validateTopUp('10.5').error).toBe('Enter a whole number of rupees, for example 5000');
  });
});

describe('isValidTopUpCents', () => {
  it('accepts whole rupees above zero up to Rs. 1,000,000', () => {
    expect(isValidTopUpCents(100)).toBeTrue();
    expect(isValidTopUpCents(100_000_000)).toBeTrue();
  });

  it('rejects zero, negatives, part rupees, too much and non-numbers', () => {
    for (const cents of [0, -100, 150, 100_000_100, Number.NaN, Number.POSITIVE_INFINITY, 1e30]) {
      expect(isValidTopUpCents(cents)).withContext(String(cents)).toBeFalse();
    }
  });
});
