import { PRODUCT_SEED } from '../services/data/in-memory/seed/product.seed';
import {
  EMPTY_CELL,
  formatBatchExpiry,
  formatProductDetails,
  formatUnitPlural,
} from './product-display.util';

describe('product-display.util', () => {
  it('shows the earliest-expiring batch with its expiry', () => {
    expect(formatBatchExpiry(PRODUCT_SEED[0])).toBe('B2405 / Exp Mar 2027');
  });

  it('shows a dash when batch tracking is off or no batch has been received', () => {
    expect(formatBatchExpiry(PRODUCT_SEED[9])).toBe(EMPTY_CELL);
    expect(formatBatchExpiry(PRODUCT_SEED[5])).toBe(EMPTY_CELL);
    expect(formatBatchExpiry({ ...PRODUCT_SEED[0], batches: [] })).toBe(EMPTY_CELL);
  });

  it('joins category, generic name and form', () => {
    expect(formatProductDetails(PRODUCT_SEED[0])).toBe('Analgesic · Paracetamol · Tablet');
    const noGeneric = formatProductDetails({ ...PRODUCT_SEED[0], genericName: '' });
    expect(noGeneric).toBe('Analgesic · Tablet');
  });

  it('makes a plural unit for suffixes', () => {
    expect(formatUnitPlural('tablet')).toBe('tablets');
  });
});
