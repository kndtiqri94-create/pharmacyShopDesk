import { BankAccount } from '../models/domain/bank-account.model';
import { rupeesToCents } from './money.util';
import { parseNonNegativeNumber } from './product-validation.util';
import { SRI_LANKAN_BANKS } from './sri-lankan-banks.const';

export const BANK_TEXT_MIN_LENGTH = 2;
export const BANK_TEXT_MAX_LENGTH = 60;
export const ACCOUNT_NO_MIN_LENGTH = 6;
export const ACCOUNT_NO_MAX_LENGTH = 20;
export const OPENING_BALANCE_MAX_LENGTH = 14;
export const ONLINE_NOTE_MAX_LENGTH = 200;
export const CARD_LAST4_LENGTH = 4;
export const DUPLICATE_ACCOUNT_MESSAGE = 'This account already exists for that bank.';
export const CARD_LAST4_MESSAGE = 'Enter exactly 4 digits, or leave it empty.';

const OPENING_BALANCE_DECIMALS = 2;
const MAX_OPENING_BALANCE_RUPEES = 1_000_000_000;

export interface BankAccountInput {
  bank: string;
  branch: string;
  holderName: string;
  accountNo: string;
  openingBalance: string;
}

export type BankAccountField = keyof BankAccountInput;

export type BankAccountErrors = Partial<Record<BankAccountField, string>>;

export interface BankAccountValues {
  bank: string;
  branch: string;
  holderName: string;
  accountNo: string;
  openingBalanceCents: number;
}

export type BankAccountValidation =
  { ok: true; values: BankAccountValues } | { ok: false; errors: BankAccountErrors };

export function onlyDigits(text: string, maxLength: number): string {
  return [...text]
    .filter(char => char >= '0' && char <= '9')
    .join('')
    .slice(0, maxLength);
}

export function isValidCardLast4(text: string): boolean {
  return (
    text.length === 0 ||
    (text.length === CARD_LAST4_LENGTH && onlyDigits(text, text.length) === text)
  );
}

function textError(label: string, value: string): string | null {
  const length = value.trim().length;
  return length < BANK_TEXT_MIN_LENGTH || length > BANK_TEXT_MAX_LENGTH
    ? `${label} must be ${BANK_TEXT_MIN_LENGTH} to ${BANK_TEXT_MAX_LENGTH} characters.`
    : null;
}

function accountNoError(value: string): string | null {
  const valid =
    onlyDigits(value, value.length) === value &&
    value.length >= ACCOUNT_NO_MIN_LENGTH &&
    value.length <= ACCOUNT_NO_MAX_LENGTH;
  return valid
    ? null
    : `Account No must be ${ACCOUNT_NO_MIN_LENGTH} to ${ACCOUNT_NO_MAX_LENGTH} digits.`;
}

function openingBalanceCents(value: string): number | null {
  const rupees = parseNonNegativeNumber(value, OPENING_BALANCE_DECIMALS);
  return rupees === null || rupees > MAX_OPENING_BALANCE_RUPEES ? null : rupeesToCents(rupees);
}

export function validateBankAccount(input: BankAccountInput): BankAccountValidation {
  const errors: BankAccountErrors = {};
  if (!SRI_LANKAN_BANKS.includes(input.bank)) errors.bank = 'Choose a bank from the list.';
  const branchError = textError('Branch', input.branch);
  if (branchError !== null) errors.branch = branchError;
  const holderError = textError('Holder Name', input.holderName);
  if (holderError !== null) errors.holderName = holderError;
  const accountError = accountNoError(input.accountNo);
  if (accountError !== null) errors.accountNo = accountError;
  const cents = openingBalanceCents(input.openingBalance);
  if (cents === null) errors.openingBalance = 'Enter 0 or more, with up to two decimals.';
  if (Object.keys(errors).length > 0 || cents === null) return { ok: false, errors };
  return {
    ok: true,
    values: {
      bank: input.bank,
      branch: input.branch.trim(),
      holderName: input.holderName.trim(),
      accountNo: input.accountNo,
      openingBalanceCents: cents,
    },
  };
}

export function isDuplicateAccount(
  accounts: readonly BankAccount[],
  bank: string,
  accountNo: string
): boolean {
  return accounts.some(account => account.bank === bank && account.accountNo === accountNo);
}

export function bankAccountLabel(account: BankAccount): string {
  return `${account.bank} - ${account.accountNo} (${account.holderName})`;
}

export function sortAccountsByBank(accounts: readonly BankAccount[]): BankAccount[] {
  const sorted = [...accounts];
  sorted.sort(
    (left, right) =>
      left.bank.localeCompare(right.bank) || left.accountNo.localeCompare(right.accountNo)
  );
  return sorted;
}
