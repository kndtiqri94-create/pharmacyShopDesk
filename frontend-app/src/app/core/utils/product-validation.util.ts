import { Product } from '../models/domain/product.model';
import { rupeesToCents } from './money.util';

export const PRODUCT_UNITS = [
  'tablet',
  'capsule',
  'sachet',
  'inhaler',
  'bottle',
  'piece',
  'strip',
  'tube',
  'box',
  'vial',
] as const;

export const TAX_RATE_OPTIONS = [0, 8, 18] as const;

export const FIELD_MAX_LENGTH = {
  name: 120,
  genericName: 120,
  manufacturer: 120,
  category: 60,
  sku: 40,
  barcode: 40,
  shelfLocation: 40,
} as const;

export const MAX_PRICE_RUPEES = 10_000_000;
export const MAX_QUANTITY = 10_000_000;
const MAX_NUMBER_TEXT_LENGTH = 14;
const MAX_MONEY_DECIMALS = 2;

export type ProductFieldKey =
  | 'name'
  | 'unit'
  | 'genericName'
  | 'category'
  | 'manufacturer'
  | 'sku'
  | 'barcode'
  | 'costPrice'
  | 'sellingPrice'
  | 'taxRate'
  | 'reorderLevel'
  | 'openingStock'
  | 'shelfLocation';

export const PRODUCT_FIELD_ORDER: readonly ProductFieldKey[] = [
  'name',
  'unit',
  'genericName',
  'category',
  'manufacturer',
  'sku',
  'barcode',
  'costPrice',
  'sellingPrice',
  'taxRate',
  'reorderLevel',
  'openingStock',
  'shelfLocation',
];

export interface ProductFormInput {
  name: string;
  unit: string;
  genericName: string;
  category: string;
  manufacturer: string;
  sku: string;
  barcode: string;
  costPrice: string;
  sellingPrice: string;
  taxRate: string;
  reorderLevel: string;
  openingStock: string;
  shelfLocation: string;
}

export interface ValidatedProductValues {
  name: string;
  unit: string;
  genericName: string;
  category: string;
  manufacturer: string;
  sku: string;
  barcode: string;
  costCents: number;
  priceCents: number;
  taxRatePercent: number;
  reorderLevel: number;
  openingStock: number;
  shelfLocation: string;
}

export type ProductFieldErrors = Partial<Record<ProductFieldKey, string>>;

export interface ProductValidationResult {
  errors: ProductFieldErrors;
  values: ValidatedProductValues | null;
  firstErrorField: ProductFieldKey | null;
}

export interface ProductValidationContext {
  existingProducts: readonly Product[];
  editingId: string | null;
  defaultReorderLevel: number;
}

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}

export function parseNonNegativeNumber(text: string, maxDecimals: number): number | null {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NUMBER_TEXT_LENGTH) return null;
  const [whole, fraction, ...rest] = trimmed.split('.');
  if (rest.length > 0 || whole.length === 0 || fraction === '') return null;
  if (fraction !== undefined && (maxDecimals === 0 || fraction.length > maxDecimals)) return null;
  const allDigits = [...whole, ...(fraction ?? '')].every(isDigit);
  return allDigits ? Number(trimmed) : null;
}

function isAllowedCode(text: string): boolean {
  return [...text].every(char => /[A-Za-z0-9._-]/.test(char));
}

function checkLength(
  errors: ProductFieldErrors,
  key: keyof typeof FIELD_MAX_LENGTH,
  label: string,
  value: string
): void {
  if (value.length > FIELD_MAX_LENGTH[key]) {
    errors[key] = `${label} must be ${FIELD_MAX_LENGTH[key]} characters or fewer`;
  }
}

function validateText(errors: ProductFieldErrors, input: ProductFormInput): void {
  if (input.name.trim().length === 0) errors.name = 'Enter the product name';
  else checkLength(errors, 'name', 'Product name', input.name.trim());
  if (input.category.trim().length === 0) errors.category = 'Enter the category';
  else checkLength(errors, 'category', 'Category', input.category.trim());
  checkLength(errors, 'genericName', 'Generic name', input.genericName.trim());
  checkLength(errors, 'manufacturer', 'Manufacturer', input.manufacturer.trim());
  checkLength(errors, 'shelfLocation', 'Shelf or location', input.shelfLocation.trim());
  if (!(PRODUCT_UNITS as readonly string[]).includes(input.unit)) errors.unit = 'Choose a unit';
}

function validateCodes(
  errors: ProductFieldErrors,
  input: ProductFormInput,
  context: ProductValidationContext
): void {
  const sku = input.sku.trim();
  const barcode = input.barcode.trim();
  if (sku.length > FIELD_MAX_LENGTH.sku) errors.sku = 'SKU must be 40 characters or fewer';
  else if (!isAllowedCode(sku))
    errors.sku = 'Use only letters, numbers, dots, dashes or underscores in the SKU';
  else if (sku.length > 0 && isSkuTaken(sku, context))
    errors.sku = 'That SKU is already used by another product';
  if (barcode.length > FIELD_MAX_LENGTH.barcode)
    errors.barcode = 'Barcode must be 40 characters or fewer';
  else if (!isAllowedCode(barcode))
    errors.barcode = 'Use only letters, numbers, dots, dashes or underscores in the barcode';
}

export function isSkuTaken(sku: string, context: ProductValidationContext): boolean {
  const wanted = sku.trim().toLowerCase();
  return context.existingProducts.some(
    product => product.id !== context.editingId && product.sku.trim().toLowerCase() === wanted
  );
}

function validateNumbers(
  errors: ProductFieldErrors,
  input: ProductFormInput,
  context: ProductValidationContext
): Pick<
  ValidatedProductValues,
  'costCents' | 'priceCents' | 'taxRatePercent' | 'reorderLevel' | 'openingStock'
> {
  const cost =
    input.costPrice.trim() === '' ? 0 : parseNonNegativeNumber(input.costPrice, MAX_MONEY_DECIMALS);
  const price = parseNonNegativeNumber(input.sellingPrice, MAX_MONEY_DECIMALS);
  const reorder =
    input.reorderLevel.trim() === ''
      ? context.defaultReorderLevel
      : parseNonNegativeNumber(input.reorderLevel, 0);
  const opening =
    input.openingStock.trim() === '' ? 0 : parseNonNegativeNumber(input.openingStock, 0);
  const tax = Number(input.taxRate);
  if (cost === null || cost > MAX_PRICE_RUPEES)
    errors.costPrice = 'Enter the cost price as an amount, zero or more';
  if (price === null || price <= 0 || price > MAX_PRICE_RUPEES)
    errors.sellingPrice = 'Enter a selling price above zero';
  if (reorder === null || reorder > MAX_QUANTITY)
    errors.reorderLevel = 'Enter the reorder level as a whole number, zero or more';
  if (opening === null || opening > MAX_QUANTITY)
    errors.openingStock = 'Enter the opening stock as a whole number, zero or more';
  if (input.taxRate.trim() === '' || !(TAX_RATE_OPTIONS as readonly number[]).includes(tax))
    errors.taxRate = 'Choose a tax rate';
  return {
    costCents: rupeesToCents(cost ?? 0),
    priceCents: rupeesToCents(price ?? 0),
    taxRatePercent: tax,
    reorderLevel: reorder ?? 0,
    openingStock: opening ?? 0,
  };
}

export function validateProduct(
  input: ProductFormInput,
  context: ProductValidationContext
): ProductValidationResult {
  const errors: ProductFieldErrors = {};
  validateText(errors, input);
  validateCodes(errors, input, context);
  const numbers = validateNumbers(errors, input, context);
  const firstErrorField = PRODUCT_FIELD_ORDER.find(key => errors[key] !== undefined) ?? null;
  if (firstErrorField !== null) return { errors, values: null, firstErrorField };
  return {
    errors,
    firstErrorField: null,
    values: {
      name: input.name.trim(),
      unit: input.unit,
      genericName: input.genericName.trim(),
      category: input.category.trim(),
      manufacturer: input.manufacturer.trim(),
      sku: input.sku.trim(),
      barcode: input.barcode.trim(),
      shelfLocation: input.shelfLocation.trim(),
      ...numbers,
    },
  };
}
