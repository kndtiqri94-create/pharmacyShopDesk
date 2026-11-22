import { parseDiscountPercent } from './pos-discount.util';
import { parseNonNegativeNumber } from './product-validation.util';

export const SETTINGS_GROUPS = [
  { id: 'shop-profile', label: 'Shop profile' },
  { id: 'currency-region', label: 'Currency & region' },
  { id: 'inventory-alerts', label: 'Inventory alerts' },
  { id: 'point-of-sale', label: 'Point of sale' },
  { id: 'backup-sync', label: 'Backup & sync' },
] as const;

export type SettingsGroupId = (typeof SETTINGS_GROUPS)[number]['id'];

export const SETTINGS_TEXT_MAX_LENGTH = {
  shopName: 80,
  registrationNo: 40,
  address: 200,
  phone: 30,
  email: 120,
} as const;

export const EXPIRY_DAYS_RANGE = { min: 1, max: 365 } as const;
export const REORDER_LEVEL_RANGE = { min: 1, max: 10_000 } as const;
export const LOW_FLOAT_RUPEES_RANGE = { min: 0, max: 1_000_000 } as const;
export const SETTINGS_NUMBER_MAX_LENGTH = 9;

export type SettingsFieldKey =
  | 'shopName'
  | 'registrationNo'
  | 'address'
  | 'phone'
  | 'email'
  | 'expiryAlertDays'
  | 'defaultReorderLevel'
  | 'lowFloatRupees'
  | 'posDefaultDiscountPercent'
  | 'posMaxDiscountPercent';

export const SETTINGS_FIELD_ORDER: readonly SettingsFieldKey[] = [
  'shopName',
  'registrationNo',
  'address',
  'phone',
  'email',
  'expiryAlertDays',
  'defaultReorderLevel',
  'lowFloatRupees',
  'posDefaultDiscountPercent',
  'posMaxDiscountPercent',
];

export const SETTINGS_FIELD_GROUP: Record<SettingsFieldKey, SettingsGroupId> = {
  shopName: 'shop-profile',
  registrationNo: 'shop-profile',
  address: 'shop-profile',
  phone: 'shop-profile',
  email: 'shop-profile',
  expiryAlertDays: 'inventory-alerts',
  defaultReorderLevel: 'inventory-alerts',
  lowFloatRupees: 'inventory-alerts',
  posDefaultDiscountPercent: 'point-of-sale',
  posMaxDiscountPercent: 'point-of-sale',
};

export interface SettingsDraft {
  shopName: string;
  registrationNo: string;
  address: string;
  phone: string;
  email: string;
  expiryAlertDays: string;
  defaultReorderLevel: string;
  lowFloatRupees: string;
  sellEarliestExpiringFirst: boolean;
  blockExpiredSales: boolean;
  showLowStockCountInSidebar: boolean;
  posLineDiscountEnabled: boolean;
  posBillDiscountEnabled: boolean;
  posDefaultDiscountPercent: string;
  posMaxDiscountPercent: string;
  posHideSidebar: boolean;
}

export interface ValidatedSettings {
  shopName: string;
  registrationNo: string;
  address: string;
  phone: string;
  email: string;
  expiryAlertDays: number;
  defaultReorderLevel: number;
  lowFloatRupees: number;
  sellEarliestExpiringFirst: boolean;
  blockExpiredSales: boolean;
  showLowStockCountInSidebar: boolean;
  posLineDiscountEnabled: boolean;
  posBillDiscountEnabled: boolean;
  posDefaultDiscountPercent: number;
  posMaxDiscountPercent: number;
  posHideSidebar: boolean;
}

export type SettingsFieldErrors = Partial<Record<SettingsFieldKey, string>>;

export interface SettingsValidationResult {
  errors: SettingsFieldErrors;
  values: ValidatedSettings | null;
  firstErrorField: SettingsFieldKey | null;
}

interface WholeNumberRule {
  min: number;
  max: number;
}

function wholeNumberError(text: string, rule: WholeNumberRule, what: string): string | null {
  const value = parseNonNegativeNumber(text, 0);
  const valid =
    value !== null &&
    text.trim().length <= SETTINGS_NUMBER_MAX_LENGTH &&
    value >= rule.min &&
    value <= rule.max;
  return valid ? null : what;
}

export function looksLikeEmail(text: string): boolean {
  if (text.length === 0 || [...text].some(char => char === ' ' || char === '\t')) return false;
  const parts = text.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (local.length === 0 || domain.length < 3) return false;
  const labels = domain.split('.');
  return labels.length >= 2 && labels.every(label => label.length > 0);
}

function validateText(errors: SettingsFieldErrors, draft: SettingsDraft): void {
  const labels: Record<keyof typeof SETTINGS_TEXT_MAX_LENGTH, string> = {
    shopName: 'Shop name',
    registrationNo: 'Registration no',
    address: 'Address',
    phone: 'Phone',
    email: 'Email',
  };
  for (const key of Object.keys(SETTINGS_TEXT_MAX_LENGTH) as (keyof typeof labels)[]) {
    if (draft[key].trim().length > SETTINGS_TEXT_MAX_LENGTH[key]) {
      errors[key] = `${labels[key]} must be ${SETTINGS_TEXT_MAX_LENGTH[key]} characters or fewer`;
    }
  }
  if (draft.shopName.trim().length === 0) errors.shopName = 'Enter the shop name';
  const email = draft.email.trim();
  if (errors.email === undefined && email.length > 0 && !looksLikeEmail(email)) {
    errors.email = 'Enter an email address like name@example.com, or leave it empty';
  }
}

function validateNumbers(errors: SettingsFieldErrors, draft: SettingsDraft): void {
  const expiry = wholeNumberError(
    draft.expiryAlertDays,
    EXPIRY_DAYS_RANGE,
    'Enter a whole number of days from 1 to 365'
  );
  const reorder = wholeNumberError(
    draft.defaultReorderLevel,
    REORDER_LEVEL_RANGE,
    'Enter a whole number of units from 1 to 10,000'
  );
  const lowFloat = wholeNumberError(
    draft.lowFloatRupees,
    LOW_FLOAT_RUPEES_RANGE,
    'Enter a whole amount of rupees from 0 to 1,000,000'
  );
  if (expiry !== null) errors.expiryAlertDays = expiry;
  if (reorder !== null) errors.defaultReorderLevel = reorder;
  if (lowFloat !== null) errors.lowFloatRupees = lowFloat;
}

const PERCENT_MESSAGE = 'Enter a percentage from 0 to 100, with at most two decimals';

function validatePosPercents(errors: SettingsFieldErrors, draft: SettingsDraft): void {
  const maxPercent = parseDiscountPercent(draft.posMaxDiscountPercent);
  const defaultPercent = parseDiscountPercent(draft.posDefaultDiscountPercent);
  if (maxPercent === null) errors.posMaxDiscountPercent = PERCENT_MESSAGE;
  if (defaultPercent === null) errors.posDefaultDiscountPercent = PERCENT_MESSAGE;
  if (maxPercent !== null && defaultPercent !== null && defaultPercent > maxPercent) {
    errors.posDefaultDiscountPercent = `The default discount cannot be more than the maximum (${maxPercent}%)`;
  }
}

export function validateSettings(draft: SettingsDraft): SettingsValidationResult {
  const errors: SettingsFieldErrors = {};
  validateText(errors, draft);
  validateNumbers(errors, draft);
  validatePosPercents(errors, draft);
  const firstErrorField = SETTINGS_FIELD_ORDER.find(key => errors[key] !== undefined) ?? null;
  if (firstErrorField !== null) return { errors, values: null, firstErrorField };
  return {
    errors,
    firstErrorField: null,
    values: {
      shopName: draft.shopName.trim(),
      registrationNo: draft.registrationNo.trim(),
      address: draft.address.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      expiryAlertDays: Number(draft.expiryAlertDays.trim()),
      defaultReorderLevel: Number(draft.defaultReorderLevel.trim()),
      lowFloatRupees: Number(draft.lowFloatRupees.trim()),
      sellEarliestExpiringFirst: draft.sellEarliestExpiringFirst,
      blockExpiredSales: draft.blockExpiredSales,
      showLowStockCountInSidebar: draft.showLowStockCountInSidebar,
      posLineDiscountEnabled: draft.posLineDiscountEnabled,
      posBillDiscountEnabled: draft.posBillDiscountEnabled,
      posDefaultDiscountPercent: parseDiscountPercent(draft.posDefaultDiscountPercent) ?? 0,
      posMaxDiscountPercent: parseDiscountPercent(draft.posMaxDiscountPercent) ?? 0,
      posHideSidebar: draft.posHideSidebar,
    },
  };
}
