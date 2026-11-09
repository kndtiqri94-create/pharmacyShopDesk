import { BANK_ACCOUNT_SEED } from '../services/data/in-memory/seed/bank-account.seed';
import {
  BankAccountInput,
  bankAccountLabel,
  isDuplicateAccount,
  isValidCardLast4,
  onlyDigits,
  sortAccountsByBank,
  validateBankAccount,
} from './bank-account-validation.util';
import { SRI_LANKAN_BANKS } from './sri-lankan-banks.const';

const VALID: BankAccountInput = {
  bank: 'HSBC',
  branch: 'Kandy',
  holderName: 'ShopDesk Pharmacy',
  accountNo: '123456',
  openingBalance: '0',
};

function errorsFor(patch: Partial<BankAccountInput>) {
  const result = validateBankAccount({ ...VALID, ...patch });
  return result.ok ? {} : result.errors;
}

describe('bank account validation', () => {
  it('accepts a valid account and converts the opening balance to cents', () => {
    const result = validateBankAccount({ ...VALID, openingBalance: '1250.50' });
    expect(result.ok && result.values.openingBalanceCents).toBe(125_050);
  });

  it('has the 24 banks of the fixed list in order', () => {
    expect(SRI_LANKAN_BANKS).toHaveSize(24);
    expect(SRI_LANKAN_BANKS[0]).toBe('Bank of Ceylon');
    expect(SRI_LANKAN_BANKS[23]).toBe('Citibank');
  });

  it('requires a bank from the fixed list', () => {
    expect(errorsFor({ bank: '' }).bank).toBeDefined();
    expect(errorsFor({ bank: 'Free Text Bank' }).bank).toBeDefined();
  });

  it('wants 2 to 60 characters for Branch and Holder Name', () => {
    for (const field of ['branch', 'holderName'] as const) {
      expect(errorsFor({ [field]: 'a' })[field]).toBeDefined();
      expect(errorsFor({ [field]: ' a ' })[field]).toBeDefined();
      expect(errorsFor({ [field]: 'ab' })[field]).toBeUndefined();
      expect(errorsFor({ [field]: 'a'.repeat(60) })[field]).toBeUndefined();
      expect(errorsFor({ [field]: 'a'.repeat(61) })[field]).toBeDefined();
    }
  });

  it('wants 6 to 20 digits for Account No', () => {
    expect(errorsFor({ accountNo: '12345' }).accountNo).toBeDefined();
    expect(errorsFor({ accountNo: '123456' }).accountNo).toBeUndefined();
    expect(errorsFor({ accountNo: '1'.repeat(20) }).accountNo).toBeUndefined();
    expect(errorsFor({ accountNo: '1'.repeat(21) }).accountNo).toBeDefined();
    expect(errorsFor({ accountNo: '12345a' }).accountNo).toBeDefined();
  });

  it('wants an Opening Balance of 0 or more with at most two decimals', () => {
    for (const good of ['0', '0.00', '10', '10.5', '10.55']) {
      expect(errorsFor({ openingBalance: good }).openingBalance)
        .withContext(good)
        .toBeUndefined();
    }
    for (const bad of ['', '-1', 'abc', '10.555', '1e3', '1,000']) {
      expect(errorsFor({ openingBalance: bad }).openingBalance)
        .withContext(bad)
        .toBeDefined();
    }
  });

  it('reports every invalid field together', () => {
    const result = validateBankAccount({
      bank: '',
      branch: '',
      holderName: '',
      accountNo: '',
      openingBalance: '',
    });
    expect(result.ok ? [] : Object.keys(result.errors).sort()).toEqual([
      'accountNo',
      'bank',
      'branch',
      'holderName',
      'openingBalance',
    ]);
  });

  it('keeps digits only, up to the limit', () => {
    expect(onlyDigits('12-34 ab56', 4)).toBe('1234');
  });

  it('accepts an empty or exact 4 digit card last 4 only', () => {
    expect(isValidCardLast4('')).toBeTrue();
    expect(isValidCardLast4('1234')).toBeTrue();
    for (const bad of ['1', '12', '123', '12345', 'abcd']) {
      expect(isValidCardLast4(bad)).withContext(bad).toBeFalse();
    }
  });

  it('spots a duplicate bank and account number', () => {
    expect(isDuplicateAccount(BANK_ACCOUNT_SEED, 'Sampath Bank', '1002345678')).toBeTrue();
    expect(isDuplicateAccount(BANK_ACCOUNT_SEED, 'HSBC', '1002345678')).toBeFalse();
  });

  it('labels and sorts accounts by bank', () => {
    const sorted = sortAccountsByBank([...BANK_ACCOUNT_SEED].reverse());
    expect(sorted.map(account => account.bank)).toEqual([
      'Bank of Ceylon',
      'Commercial Bank of Ceylon',
      'Sampath Bank',
    ]);
    expect(bankAccountLabel(BANK_ACCOUNT_SEED[0])).toBe(
      'Bank of Ceylon - 0012345678 (ShopDesk Pharmacy)'
    );
  });
});
