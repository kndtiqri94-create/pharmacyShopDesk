import { Employee } from '../models/domain/employee.model';
import { EmployeeAllowance } from '../models/domain/employee-allowance.model';
import { EmployeeStatus } from '../models/enums/employee-status.enum';
import { EMPLOYEE_TITLES, EmployeeTitle } from '../models/enums/employee-title.enum';
import { SalaryType } from '../models/enums/salary-type.enum';
import { isIsoDate } from './date.util';
import { rupeesToCents } from './money.util';
import { MAX_PRICE_RUPEES, parseNonNegativeNumber } from './product-validation.util';

export const EMPLOYEE_FIELD_LIMITS = {
  codeMin: 2,
  codeMax: 20,
  name: 50,
  email: 100,
  addressLine: 100,
  addressPart: 50,
  zip: 20,
  allowanceName: 50,
  customField: 100,
  maxAllowances: 20,
  mobileDigits: 9,
  maxPercent: 100,
  minBirthYear: 1900,
} as const;

const MONEY_DECIMALS = 2;

const SCALAR_FIELD_ORDER = [
  'title',
  'code',
  'location',
  'firstName',
  'middleName',
  'lastName',
  'mobile',
  'email',
  'dateOfBirth',
  'addressLine1',
  'addressLine2',
  'city',
  'suburb',
  'state',
  'country',
  'zip',
  'salaryType',
  'basicSalary',
] as const;

const TRAILING_FIELD_ORDER = [
  'overTimeRate',
  'commissionRate',
  'productDiscountRate',
  'invoiceDiscountRate',
  'monthlyTarget',
  'customField1',
  'customField2',
  'customField3',
  'customField4',
  'status',
  'photo',
] as const;

export type EmployeeFieldErrors = Record<string, string>;

export interface AllowanceInput {
  id: string;
  name: string;
  amount: string;
}

export interface EmployeeFormInput {
  title: string;
  code: string;
  location: string;
  firstName: string;
  middleName: string;
  lastName: string;
  mobile: string;
  email: string;
  dateOfBirth: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  suburb: string;
  state: string;
  country: string;
  zip: string;
  calculateEpf: boolean;
  calculateEtf: boolean;
  salaryType: string;
  basicSalary: string;
  allowances: AllowanceInput[];
  overTimeRate: string;
  commissionRate: string;
  productDiscountRate: string;
  invoiceDiscountRate: string;
  monthlyTarget: string;
  considerAsCustomer: boolean;
  createUserAccount: boolean;
  customField1: string;
  customField2: string;
  customField3: string;
  customField4: string;
  status: string;
  photoDataUrl: string | null;
}

export interface EmployeeValidationContext {
  employees: readonly Employee[];
  editingId: string | null;
  today: string;
}

export interface ValidatedEmployee {
  title: EmployeeTitle;
  code: string;
  location: string;
  firstName: string;
  middleName: string;
  lastName: string;
  mobile: string;
  email: string;
  dateOfBirth: string | null;
  addressLine1: string;
  addressLine2: string;
  city: string;
  suburb: string;
  state: string;
  country: string;
  zip: string;
  calculateEpf: boolean;
  calculateEtf: boolean;
  salaryType: SalaryType;
  basicSalaryCents: number;
  allowances: EmployeeAllowance[];
  overTimeRateCents: number;
  commissionRate: number;
  productDiscountRate: number;
  invoiceDiscountRate: number;
  monthlyTargetCents: number;
  considerAsCustomer: boolean;
  createUserAccount: boolean;
  customField1: string;
  customField2: string;
  customField3: string;
  customField4: string;
  status: EmployeeStatus;
  photoDataUrl: string | null;
}

export interface EmployeeValidationResult {
  errors: EmployeeFieldErrors;
  firstErrorField: string | null;
  values: ValidatedEmployee | null;
}

export function allowanceFieldKey(index: number, part: 'name' | 'amount'): string {
  return `allowance-${index}-${part}`;
}

export function normalizeEmployeeCode(code: string): string {
  return code.trim().toLowerCase();
}

export function isEmployeeCodeTaken(
  code: string,
  employees: readonly Employee[],
  editingId: string | null
): boolean {
  const wanted = normalizeEmployeeCode(code);
  return employees.some(
    employee => employee.id !== editingId && normalizeEmployeeCode(employee.code) === wanted
  );
}

export function stripSpaces(text: string): string {
  return text.split(' ').join('');
}

function isDigits(text: string): boolean {
  return text.length > 0 && [...text].every(char => char >= '0' && char <= '9');
}

function isMobile(text: string): boolean {
  const digits = stripSpaces(text.trim());
  if (!isDigits(digits)) return false;
  return digits.length === EMPLOYEE_FIELD_LIMITS.mobileDigits;
}

function isEmailShape(text: string): boolean {
  if (text.length > EMPLOYEE_FIELD_LIMITS.email || /\s/.test(text)) return false;
  const pieces = text.split('@');
  if (pieces.length !== 2) return false;
  const [local, domain] = pieces;
  if (local.length === 0 || domain.length < 3) return false;
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return false;
  return !domain.includes('..') && !local.startsWith('.') && !local.endsWith('.');
}

function isCodeShape(code: string): boolean {
  return (
    code.length >= EMPLOYEE_FIELD_LIMITS.codeMin &&
    code.length <= EMPLOYEE_FIELD_LIMITS.codeMax &&
    [...code].every(char => /[A-Za-z0-9_-]/.test(char))
  );
}

function isPhotoDataUrl(value: string): boolean {
  return value.startsWith('data:image/png;base64,') || value.startsWith('data:image/jpeg;base64,');
}

function checkRequiredText(
  errors: EmployeeFieldErrors,
  key: string,
  label: string,
  value: string,
  max: number
): void {
  if (value.length === 0) errors[key] = `Enter the ${label}`;
  else if (value.length > max) errors[key] = `The ${label} must be ${max} characters or fewer`;
}

function checkOptionalText(
  errors: EmployeeFieldErrors,
  key: string,
  label: string,
  value: string,
  max: number
): void {
  if (value.length > max) errors[key] = `The ${label} must be ${max} characters or fewer`;
}

function checkIdentity(
  errors: EmployeeFieldErrors,
  input: EmployeeFormInput,
  context: EmployeeValidationContext
): void {
  if (input.title === '') errors['title'] = 'Choose a title';
  else if (!(EMPLOYEE_TITLES as readonly string[]).includes(input.title)) {
    errors['title'] = 'Choose a title from the list';
  }
  const code = input.code.trim();
  if (code.length === 0) errors['code'] = 'Enter the EMP Code';
  else if (!isCodeShape(code)) {
    errors['code'] = 'EMP Code must be 2 to 20 letters, numbers, hyphens or underscores';
  } else if (isEmployeeCodeTaken(code, context.employees, context.editingId)) {
    errors['code'] = 'That EMP Code is already in use. Choose another';
  }
  checkRequiredText(errors, 'location', 'location', input.location.trim(), 100);
  checkRequiredText(errors, 'firstName', 'first name', input.firstName.trim(), 50);
  checkOptionalText(errors, 'middleName', 'middle name', input.middleName.trim(), 50);
  checkRequiredText(errors, 'lastName', 'last name', input.lastName.trim(), 50);
}

function checkContact(
  errors: EmployeeFieldErrors,
  input: EmployeeFormInput,
  context: EmployeeValidationContext
): void {
  const mobile = input.mobile.trim();
  if (mobile.length === 0) errors['mobile'] = 'Enter the mobile number';
  else if (!isMobile(mobile))
    errors['mobile'] = 'Enter a mobile number of 9 digits, like 77XXXXXXX';
  const email = input.email.trim();
  if (email.length > 0 && !isEmailShape(email)) {
    errors['email'] = 'Enter an email address like name@example.com';
  }
  const dob = input.dateOfBirth.trim();
  if (dob.length === 0) return;
  const year = Number(dob.slice(0, 4));
  if (!isIsoDate(dob) || year < EMPLOYEE_FIELD_LIMITS.minBirthYear) {
    errors['dateOfBirth'] = 'Enter a real date of birth';
  } else if (dob > context.today) {
    errors['dateOfBirth'] = 'Date of birth cannot be in the future';
  }
}

function checkAddress(errors: EmployeeFieldErrors, input: EmployeeFormInput): void {
  const { addressLine, addressPart, zip } = EMPLOYEE_FIELD_LIMITS;
  checkOptionalText(
    errors,
    'addressLine1',
    'address line 1',
    input.addressLine1.trim(),
    addressLine
  );
  checkOptionalText(
    errors,
    'addressLine2',
    'address line 2',
    input.addressLine2.trim(),
    addressLine
  );
  checkOptionalText(errors, 'city', 'city', input.city.trim(), addressPart);
  checkOptionalText(errors, 'suburb', 'suburb', input.suburb.trim(), addressPart);
  checkOptionalText(errors, 'state', 'state', input.state.trim(), addressPart);
  checkOptionalText(errors, 'country', 'country', input.country.trim(), addressPart);
  checkOptionalText(errors, 'zip', 'zip code', input.zip.trim(), zip);
}

function parseMoney(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  const rupees = parseNonNegativeNumber(trimmed, MONEY_DECIMALS);
  return rupees === null || rupees > MAX_PRICE_RUPEES ? null : rupees;
}

function parsePercent(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  const percent = parseNonNegativeNumber(trimmed, MONEY_DECIMALS);
  return percent === null || percent > EMPLOYEE_FIELD_LIMITS.maxPercent ? null : percent;
}

interface ParsedNumbers {
  basicSalaryCents: number;
  overTimeRateCents: number;
  monthlyTargetCents: number;
  commissionRate: number;
  productDiscountRate: number;
  invoiceDiscountRate: number;
}

function checkNumbers(errors: EmployeeFieldErrors, input: EmployeeFormInput): ParsedNumbers {
  const money = (key: string, label: string, text: string): number => {
    const rupees = parseMoney(text);
    if (rupees === null) errors[key] = `Enter the ${label} as an amount, zero or more`;
    return rupeesToCents(rupees ?? 0);
  };
  const percent = (key: string, label: string, text: string): number => {
    const value = parsePercent(text);
    if (value === null) errors[key] = `Enter the ${label} as a number from 0 to 100`;
    return value ?? 0;
  };
  return {
    basicSalaryCents: money('basicSalary', 'basic salary', input.basicSalary),
    overTimeRateCents: money('overTimeRate', 'over time rate', input.overTimeRate),
    monthlyTargetCents: money('monthlyTarget', 'monthly target', input.monthlyTarget),
    commissionRate: percent('commissionRate', 'commission rate', input.commissionRate),
    productDiscountRate: percent(
      'productDiscountRate',
      'product discount',
      input.productDiscountRate
    ),
    invoiceDiscountRate: percent(
      'invoiceDiscountRate',
      'invoice discount',
      input.invoiceDiscountRate
    ),
  };
}

function checkAllowances(
  errors: EmployeeFieldErrors,
  allowances: readonly AllowanceInput[]
): EmployeeAllowance[] {
  if (allowances.length > EMPLOYEE_FIELD_LIMITS.maxAllowances) {
    errors['allowances'] = `Add no more than ${EMPLOYEE_FIELD_LIMITS.maxAllowances} allowances`;
  }
  return allowances.map((line, index) => {
    const name = line.name.trim();
    if (name.length === 0) errors[allowanceFieldKey(index, 'name')] = 'Enter the allowance name';
    else if (name.length > EMPLOYEE_FIELD_LIMITS.allowanceName) {
      errors[allowanceFieldKey(index, 'name')] =
        `The allowance name must be ${EMPLOYEE_FIELD_LIMITS.allowanceName} characters or fewer`;
    }
    const rupees = line.amount.trim() === '' ? null : parseMoney(line.amount);
    if (rupees === null || rupees <= 0) {
      errors[allowanceFieldKey(index, 'amount')] = 'Enter an allowance amount above zero';
    }
    return { id: line.id, name, amountCents: rupeesToCents(rupees ?? 0) };
  });
}

function checkExtras(errors: EmployeeFieldErrors, input: EmployeeFormInput): void {
  const { customField } = EMPLOYEE_FIELD_LIMITS;
  checkOptionalText(
    errors,
    'customField1',
    'custom field 1',
    input.customField1.trim(),
    customField
  );
  checkOptionalText(
    errors,
    'customField2',
    'custom field 2',
    input.customField2.trim(),
    customField
  );
  checkOptionalText(
    errors,
    'customField3',
    'custom field 3',
    input.customField3.trim(),
    customField
  );
  checkOptionalText(
    errors,
    'customField4',
    'custom field 4',
    input.customField4.trim(),
    customField
  );
  if (!(Object.values(EmployeeStatus) as string[]).includes(input.status)) {
    errors['status'] = 'Choose a status';
  }
  if (!(Object.values(SalaryType) as string[]).includes(input.salaryType)) {
    errors['salaryType'] = 'Choose a salary type';
  }
  if (input.photoDataUrl !== null && !isPhotoDataUrl(input.photoDataUrl)) {
    errors['photo'] = 'The photo must be a JPG or PNG image';
  }
}

function firstErrorOf(errors: EmployeeFieldErrors, lineCount: number): string | null {
  const allowanceKeys = Array.from({ length: lineCount }, (_, index) => [
    allowanceFieldKey(index, 'name'),
    allowanceFieldKey(index, 'amount'),
  ]).flat();
  const order = [...SCALAR_FIELD_ORDER, 'allowances', ...allowanceKeys, ...TRAILING_FIELD_ORDER];
  return order.find(key => errors[key] !== undefined) ?? null;
}

export function validateEmployee(
  input: EmployeeFormInput,
  context: EmployeeValidationContext
): EmployeeValidationResult {
  const errors: EmployeeFieldErrors = {};
  checkIdentity(errors, input, context);
  checkContact(errors, input, context);
  checkAddress(errors, input);
  const numbers = checkNumbers(errors, input);
  const allowances = checkAllowances(errors, input.allowances);
  checkExtras(errors, input);
  const firstErrorField = firstErrorOf(errors, input.allowances.length);
  if (firstErrorField !== null) return { errors, firstErrorField, values: null };
  return {
    errors,
    firstErrorField: null,
    values: {
      title: input.title as EmployeeTitle,
      code: input.code.trim(),
      location: input.location.trim(),
      firstName: input.firstName.trim(),
      middleName: input.middleName.trim(),
      lastName: input.lastName.trim(),
      mobile: stripSpaces(input.mobile.trim()),
      email: input.email.trim(),
      dateOfBirth: input.dateOfBirth.trim() === '' ? null : input.dateOfBirth.trim(),
      addressLine1: input.addressLine1.trim(),
      addressLine2: input.addressLine2.trim(),
      city: input.city.trim(),
      suburb: input.suburb.trim(),
      state: input.state.trim(),
      country: input.country.trim(),
      zip: input.zip.trim(),
      calculateEpf: input.calculateEpf,
      calculateEtf: input.calculateEtf,
      salaryType: input.salaryType as SalaryType,
      allowances,
      ...numbers,
      considerAsCustomer: input.considerAsCustomer,
      createUserAccount: input.createUserAccount,
      customField1: input.customField1.trim(),
      customField2: input.customField2.trim(),
      customField3: input.customField3.trim(),
      customField4: input.customField4.trim(),
      status: input.status as EmployeeStatus,
      photoDataUrl: input.photoDataUrl,
    },
  };
}
