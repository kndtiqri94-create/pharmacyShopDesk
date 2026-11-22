import { PRODUCT_SEED } from '../services/data/in-memory/seed/product.seed';
import {
  MAX_PRICE_RUPEES,
  ProductFormInput,
  ProductValidationContext,
  parseNonNegativeNumber,
  validateProduct,
} from './product-validation.util';

const VALID: ProductFormInput = {
  name: 'Zinc 20mg',
  unit: 'tablet',
  genericName: 'Zinc',
  category: 'Supplement',
  manufacturer: 'Island Wellness',
  sku: 'ZNC-020',
  barcode: '4791000000999',
  costPrice: '2.10',
  sellingPrice: '3.00',
  taxRate: '0',
  reorderLevel: '20',
  openingStock: '0',
  shelfLocation: 'Shelf A1',
};

const CONTEXT: ProductValidationContext = {
  existingProducts: PRODUCT_SEED,
  editingId: null,
  defaultReorderLevel: 20,
};

describe('product-validation.util', () => {
  it('accepts valid details and returns trimmed values in cents', () => {
    const result = validateProduct({ ...VALID, name: '  Zinc 20mg  ' }, CONTEXT);
    expect(result.errors).toEqual({});
    expect(result.values?.name).toBe('Zinc 20mg');
    expect(result.values?.costCents).toBe(210);
    expect(result.values?.priceCents).toBe(300);
  });

  it('requires the product name, category and selling price and finds the first problem', () => {
    const result = validateProduct(
      { ...VALID, name: ' ', category: '', sellingPrice: '' },
      CONTEXT
    );
    expect(result.values).toBeNull();
    expect(result.errors.name).toBe('Enter the product name');
    expect(result.errors.category).toBe('Enter the category');
    expect(result.errors.sellingPrice).toBe('Enter a selling price above zero');
    expect(result.firstErrorField).toBe('name');
  });

  it('rejects a selling price that is zero, negative or not a number', () => {
    for (const price of ['0', '-5', 'abc', '1e3', 'Infinity', '1.234', '1,50']) {
      expect(validateProduct({ ...VALID, sellingPrice: price }, CONTEXT).errors.sellingPrice)
        .withContext(price)
        .toBeDefined();
    }
  });

  it('rejects a negative or non-numeric cost price, reorder level and opening stock', () => {
    const result = validateProduct(
      { ...VALID, costPrice: '-1', reorderLevel: 'x', openingStock: '-3' },
      CONTEXT
    );
    expect(result.errors.costPrice).toContain('cost price');
    expect(result.errors.reorderLevel).toContain('reorder level');
    expect(result.errors.openingStock).toContain('opening stock');
    expect(result.values).toBeNull();
  });

  it('rejects a fractional quantity', () => {
    const result = validateProduct({ ...VALID, openingStock: '2.5' }, CONTEXT);
    expect(result.errors.openingStock).toBeDefined();
  });

  it('treats empty optional numbers as zero and an empty reorder level as the default', () => {
    const result = validateProduct(
      { ...VALID, costPrice: '', openingStock: '', reorderLevel: '' },
      CONTEXT
    );
    expect(result.values?.costCents).toBe(0);
    expect(result.values?.openingStock).toBe(0);
    expect(result.values?.reorderLevel).toBe(20);
  });

  it('rejects a duplicate SKU ignoring case and the product being edited', () => {
    const duplicate = validateProduct({ ...VALID, sku: 'par-500' }, CONTEXT);
    expect(duplicate.errors.sku).toBe('That SKU is already used by another product');
    const editingSelf = validateProduct(
      { ...VALID, sku: 'PAR-500' },
      { ...CONTEXT, editingId: 'prod-001' }
    );
    expect(editingSelf.errors.sku).toBeUndefined();
  });

  it('rejects oversized text and odd characters in codes', () => {
    const result = validateProduct(
      { ...VALID, name: 'a'.repeat(121), sku: 'bad sku<script>', barcode: 'b'.repeat(41) },
      CONTEXT
    );
    expect(result.errors.name).toContain('120');
    expect(result.errors.sku).toContain('letters, numbers');
    expect(result.errors.barcode).toContain('40');
  });

  it('rejects a unit or tax rate outside the allowed lists', () => {
    const result = validateProduct({ ...VALID, unit: 'crate', taxRate: '55' }, CONTEXT);
    expect(result.errors.unit).toBe('Choose a unit');
    expect(result.errors.taxRate).toBe('Choose a tax rate');
  });

  it('rejects absurdly large amounts', () => {
    const tooBig = String(MAX_PRICE_RUPEES + 1);
    const result = validateProduct({ ...VALID, sellingPrice: tooBig }, CONTEXT);
    expect(result.errors.sellingPrice).toBeDefined();
  });

  it('parses only plain non-negative numbers', () => {
    expect(parseNonNegativeNumber('12.50', 2)).toBe(12.5);
    expect(parseNonNegativeNumber('0', 0)).toBe(0);
    expect(parseNonNegativeNumber('1.5', 0)).toBeNull();
    expect(parseNonNegativeNumber('', 2)).toBeNull();
    expect(parseNonNegativeNumber('5.', 2)).toBeNull();
    expect(parseNonNegativeNumber('1.2.3', 2)).toBeNull();
  });
});
