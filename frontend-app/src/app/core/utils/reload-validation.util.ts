import { formatRupees, rupeesToCents } from './money.util';
import { parseNonNegativeNumber } from './product-validation.util';

export const RELOAD_OPERATORS = ['Dialog', 'Mobitel', 'Hutch', 'Airtel'] as const;
export const BILL_PROVIDERS = [
  'Electricity (CEB)',
  'Water (NWSDB)',
  'Telephone (SLT)',
  'Internet',
] as const;
export const AMOUNT_CHIP_RUPEES = [50, 100, 200, 500, 1000] as const;

export const MOBILE_DIGITS = 9;
export const MOBILE_INPUT_MAX_LENGTH = 15;
export const CUSTOMER_NAME_MAX_LENGTH = 60;
export const ACCOUNT_MAX_LENGTH = 30;
export const AMOUNT_INPUT_MAX_LENGTH = 12;
export const BILL_MAX_RUPEES = 1_000_000;
export const TOP_UP_MAX_RUPEES = 1_000_000;
export const TOP_UP_INPUT_MAX_LENGTH = 10;

const MONEY_DECIMALS = 2;

export type ReloadFieldKey = 'operator' | 'mobile' | 'customerName' | 'amount';
export type BillFieldKey = 'provider' | 'account' | 'amount';

export const RELOAD_FIELD_ORDER: readonly ReloadFieldKey[] = [
  'operator',
  'mobile',
  'customerName',
  'amount',
];
export const BILL_FIELD_ORDER: readonly BillFieldKey[] = ['provider', 'account', 'amount'];

export interface ReloadFormInput {
  operator: string;
  mobile: string;
  customerName: string;
  amount: string;
}

export interface BillFormInput {
  provider: string;
  account: string;
  amount: string;
}

export interface ValidatedReload {
  operator: string;
  reference: string;
  amountCents: number;
}

export interface ValidatedBill {
  provider: string;
  account: string;
  amountCents: number;
}

export type ReloadFieldErrors = Partial<Record<ReloadFieldKey, string>>;
export type BillFieldErrors = Partial<Record<BillFieldKey, string>>;

export interface ReloadValidationResult {
  errors: ReloadFieldErrors;
  values: ValidatedReload | null;
  firstErrorField: ReloadFieldKey | null;
}

export interface BillValidationResult {
  errors: BillFieldErrors;
  values: ValidatedBill | null;
  firstErrorField: BillFieldKey | null;
}

export type TopUpResult =
  { amountCents: number; error: null } | { amountCents: null; error: string };

type AmountResult = { cents: number; error: null } | { cents: null; error: string };

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}

export function stripSpaces(text: string): string {
  return text.split(' ').join('');
}

export function formatMobileReference(digits: string): string {
  return `0${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
}

function validateMobile(text: string): string | null {
  const digits = stripSpaces(text);
  if (digits.length === 0) return 'Enter the mobile number';
  if (![...digits].every(isDigit)) return 'Use digits only in the mobile number';
  if (digits.length !== MOBILE_DIGITS) {
    return `Enter the ${MOBILE_DIGITS} digits after +94, for example 77 123 4567`;
  }
  return null;
}

function parseAmount(text: string, maxCents: number): AmountResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { cents: null, error: 'Enter the amount' };
  if (trimmed.startsWith('-')) return { cents: null, error: 'Enter an amount above zero' };
  const rupees = parseNonNegativeNumber(trimmed, MONEY_DECIMALS);
  if (rupees === null) {
    return { cents: null, error: 'Enter the amount as a number, for example 500' };
  }
  if (rupees === 0) return { cents: null, error: 'Enter an amount above zero' };
  const cents = rupeesToCents(rupees);
  if (cents > maxCents) {
    return { cents: null, error: `The amount can be at most ${formatRupees(maxCents)}` };
  }
  return { cents, error: null };
}

export function validateReload(
  input: ReloadFormInput,
  availableCents: number
): ReloadValidationResult {
  const errors: ReloadFieldErrors = {};
  if (!(RELOAD_OPERATORS as readonly string[]).includes(input.operator)) {
    errors.operator = 'Choose the operator';
  }
  const mobileError = validateMobile(input.mobile);
  if (mobileError !== null) errors.mobile = mobileError;
  if (input.customerName.trim().length > CUSTOMER_NAME_MAX_LENGTH) {
    errors.customerName = `Customer name must be ${CUSTOMER_NAME_MAX_LENGTH} characters or fewer`;
  }
  const amount = parseAmount(input.amount, Math.max(0, availableCents));
  if (amount.error !== null) errors.amount = amount.error;
  const firstErrorField = RELOAD_FIELD_ORDER.find(key => errors[key] !== undefined) ?? null;
  if (firstErrorField !== null || amount.cents === null) {
    return { errors, values: null, firstErrorField };
  }
  return {
    errors,
    firstErrorField: null,
    values: {
      operator: input.operator,
      reference: formatMobileReference(stripSpaces(input.mobile)),
      amountCents: amount.cents,
    },
  };
}

export function validateBill(input: BillFormInput): BillValidationResult {
  const errors: BillFieldErrors = {};
  if (!(BILL_PROVIDERS as readonly string[]).includes(input.provider)) {
    errors.provider = 'Choose the provider';
  }
  const account = input.account.trim();
  if (account.length === 0) errors.account = 'Enter the account number';
  else if (account.length > ACCOUNT_MAX_LENGTH) {
    errors.account = `Account number must be ${ACCOUNT_MAX_LENGTH} characters or fewer`;
  }
  const amount = parseAmount(input.amount, rupeesToCents(BILL_MAX_RUPEES));
  if (amount.error !== null) errors.amount = amount.error;
  const firstErrorField = BILL_FIELD_ORDER.find(key => errors[key] !== undefined) ?? null;
  if (firstErrorField !== null || amount.cents === null) {
    return { errors, values: null, firstErrorField };
  }
  return {
    errors,
    firstErrorField: null,
    values: { provider: input.provider, account, amountCents: amount.cents },
  };
}

function invalidTopUp(error: string): TopUpResult {
  return { amountCents: null, error };
}

export function validateTopUp(text: string): TopUpResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) return invalidTopUp('Enter the amount you are adding');
  if (trimmed.startsWith('-')) return invalidTopUp('Enter an amount above zero');
  const rupees = parseNonNegativeNumber(trimmed, 0);
  if (rupees === null) return invalidTopUp('Enter a whole number of rupees, for example 5000');
  if (rupees === 0) return invalidTopUp('Enter an amount above zero');
  if (rupees > TOP_UP_MAX_RUPEES) {
    const most = formatRupees(rupeesToCents(TOP_UP_MAX_RUPEES));
    return invalidTopUp(`You can add at most ${most} at once`);
  }
  return { amountCents: rupeesToCents(rupees), error: null };
}

export function isValidTopUpCents(amountCents: number): boolean {
  const rupees = amountCents / 100;
  return (
    Number.isSafeInteger(amountCents) &&
    Number.isInteger(rupees) &&
    rupees > 0 &&
    rupees <= TOP_UP_MAX_RUPEES
  );
}
