import { Product } from '../models/domain/product.model';
import { PRODUCT_SEED } from '../services/data/in-memory/seed/product.seed';
import {
  SEARCH_RESULT_LIMIT,
  SEARCH_TEXT_MAX_LENGTH,
  findExactCodeMatch,
  normaliseSearchTerm,
  searchProducts,
} from './pos-search.util';

const PRODUCTS = PRODUCT_SEED as readonly Product[];

describe('pos search', () => {
  it('finds products by part of the name, case insensitive', () => {
    const names = searchProducts(PRODUCTS, 'PARA').map(product => product.name);
    expect(names).toContain('Paracetamol 500mg');
  });

  it('finds products by generic name, SKU and barcode', () => {
    expect(searchProducts(PRODUCTS, 'amoxicillin')[0].sku).toBe('AMX-500');
    expect(searchProducts(PRODUCTS, 'cet-0')[0].sku).toBe('CET-010');
    expect(searchProducts(PRODUCTS, '4791000000011')[0].sku).toBe('PAR-500');
  });

  it('returns nothing for an empty or unmatched term', () => {
    expect(searchProducts(PRODUCTS, '')).toEqual([]);
    expect(searchProducts(PRODUCTS, '   ')).toEqual([]);
    expect(searchProducts(PRODUCTS, 'zzzz-nothing')).toEqual([]);
  });

  it('leaves out products that are switched off', () => {
    const inactive = PRODUCTS.map(product => ({ ...product, active: false }));
    expect(searchProducts(inactive, 'para')).toEqual([]);
  });

  it('lists an out-of-stock product so the till can say why it cannot be added', () => {
    const empty = PRODUCTS.map(product => ({ ...product, batches: [], stockOnHand: 0 }));
    expect(searchProducts(empty, 'para').length).toBeGreaterThan(0);
  });

  it('puts an exact code first, then names that start with the term', () => {
    const many: Product[] = [
      { ...PRODUCTS[0], id: 'a', name: 'Zinc paracetamol', sku: 'Z1', barcode: 'b1' },
      { ...PRODUCTS[0], id: 'b', name: 'Paracetamol Plus', sku: 'P1', barcode: 'b2' },
      { ...PRODUCTS[0], id: 'c', name: 'Other', sku: 'paracetamol', barcode: 'b3' },
    ];
    expect(searchProducts(many, 'paracetamol').map(product => product.id)).toEqual(['c', 'b', 'a']);
  });

  it('caps the number of results', () => {
    const lots = Array.from({ length: 50 }, (_, index) => ({
      ...PRODUCTS[0],
      id: `p${index}`,
      name: `Item ${index}`,
      sku: `S${index}`,
      barcode: `B${index}`,
    }));
    expect(searchProducts(lots, 'item')).toHaveSize(SEARCH_RESULT_LIMIT);
  });

  it('cuts an oversized term instead of searching on all of it', () => {
    expect(normaliseSearchTerm('x'.repeat(500))).toHaveSize(SEARCH_TEXT_MAX_LENGTH);
    expect(searchProducts(PRODUCTS, 'x'.repeat(500))).toEqual([]);
  });

  describe('exact code match for scan-style Enter', () => {
    it('matches a barcode or SKU exactly, ignoring case and spaces', () => {
      expect(findExactCodeMatch(PRODUCTS, ' 4791000000011 ')?.id).toBe('prod-001');
      expect(findExactCodeMatch(PRODUCTS, 'amx-500')?.id).toBe('prod-002');
    });

    it('does not match a partial code or a name', () => {
      expect(findExactCodeMatch(PRODUCTS, 'AMX')).toBeNull();
      expect(findExactCodeMatch(PRODUCTS, 'Paracetamol 500mg')).toBeNull();
      expect(findExactCodeMatch(PRODUCTS, '')).toBeNull();
    });

    it('does not guess when two products share the code', () => {
      const twins = [PRODUCTS[0], { ...PRODUCTS[1], sku: PRODUCTS[0].sku }];
      expect(findExactCodeMatch(twins, PRODUCTS[0].sku)).toBeNull();
    });
  });
});
