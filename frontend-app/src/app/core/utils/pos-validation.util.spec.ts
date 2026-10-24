import { Product } from '../models/domain/product.model';
import { PRODUCT_SEED } from '../services/data/in-memory/seed/product.seed';
import { computeBillTotals } from './pos-totals.util';
import {
  MAX_BILL_LINES,
  checkProductAddable,
  checkQuantityAgainstStock,
  parseAmountCents,
  parseLineQuantity,
  parsePaymentEntries,
  validateHold,
  validateSaleReadiness,
} from './pos-validation.util';

const PRODUCT: Product = structuredClone(PRODUCT_SEED[0]);
const IN_STOCK = { totalQuantity: 10, sellableQuantity: 10 };
const HUNDRED = [{ unitPriceCents: 10_000, quantity: 1, discountPercent: 0 }];
const ZERO_DISCOUNT = { mode: 'PERCENT', percent: 0 } as const;

function readiness(
  cashCents: number,
  cardCents: number,
  onlineCents: number,
  creditSelected: boolean,
  isWalkIn: boolean,
  lines = HUNDRED
) {
  const amounts = { cashCents, cardCents, onlineCents, creditSelected };
  return validateSaleReadiness({
    lineCount: lines.length,
    totals: computeBillTotals(lines, ZERO_DISCOUNT, amounts),
    amounts,
    isWalkIn,
  });
}

describe('pos validation', () => {
  describe('quantity', () => {
    it('accepts whole numbers from 1 to the limit', () => {
      expect(parseLineQuantity('1')).toBe(1);
      expect(parseLineQuantity(' 25 ')).toBe(25);
      expect(parseLineQuantity('10000')).toBe(10_000);
    });

    it('refuses zero, negatives, decimals, huge numbers, words and exponents', () => {
      for (const text of ['0', '-3', '1.5', '10001', '1e9', 'abc', '', '999999999999999']) {
        expect(parseLineQuantity(text)).withContext(text).toBeNull();
      }
    });
  });

  describe('amounts', () => {
    it('reads rupees with up to two decimals as cents, tolerating a trailing point', () => {
      expect(parseAmountCents('100')).toBe(10_000);
      expect(parseAmountCents('100.5')).toBe(10_050);
      expect(parseAmountCents('0.05')).toBe(5);
      expect(parseAmountCents('7.')).toBe(700);
    });

    it('treats empty as zero', () => {
      expect(parseAmountCents('')).toBe(0);
      expect(parseAmountCents('   ')).toBe(0);
    });

    it('refuses three decimals, negatives, words, huge values and long text', () => {
      for (const text of ['1.234', '-5', 'ten', '1e9', '99999999999', '1'.repeat(40), '..']) {
        expect(parseAmountCents(text)).withContext(text).toBeNull();
      }
    });

    it('reports which payment field is wrong', () => {
      const result = parsePaymentEntries({
        cash: '10',
        card: 'x',
        online: '1.234',
        cardReference: '',
        onlineReference: '',
        creditSelected: false,
      });
      expect(result.amounts).toBeNull();
      expect(Object.keys(result.errors).sort()).toEqual(['card', 'online']);
    });

    it('returns the amounts when every field is fine', () => {
      const result = parsePaymentEntries({
        cash: '60',
        card: '40.00',
        online: '',
        cardReference: 'ref',
        onlineReference: '',
        creditSelected: true,
      });
      expect(result.amounts).toEqual({
        cashCents: 6000,
        cardCents: 4000,
        onlineCents: 0,
        creditSelected: true,
      });
    });
  });

  describe('adding a product', () => {
    it('allows an active product with stock', () => {
      expect(checkProductAddable(PRODUCT, IN_STOCK, 0, 0)).toEqual({ ok: true });
    });

    it('refuses an out-of-stock product and says so', () => {
      const result = checkProductAddable(PRODUCT, { totalQuantity: 0, sellableQuantity: 0 }, 0, 0);
      expect(result.ok === false && result.reason).toBe('OUT_OF_STOCK');
      expect(result.ok === false && result.message).toContain('out of stock');
    });

    it('refuses a product whose stock is all expired and says so', () => {
      const result = checkProductAddable(PRODUCT, { totalQuantity: 5, sellableQuantity: 0 }, 0, 0);
      expect(result.ok === false && result.reason).toBe('EXPIRED');
      expect(result.ok === false && result.message).toContain('expired');
    });

    it('refuses an inactive product', () => {
      const result = checkProductAddable({ ...PRODUCT, active: false }, IN_STOCK, 0, 0);
      expect(result.ok === false && result.reason).toBe('INACTIVE');
    });

    it('refuses one more when the bill already holds all the stock', () => {
      const result = checkProductAddable(PRODUCT, IN_STOCK, 1, 10);
      expect(result.ok === false && result.reason).toBe('STOCK_LIMIT');
      expect(result.ok === false && result.message).toContain('10');
    });

    it('refuses a new line past the line limit but allows more of an existing line', () => {
      const full = checkProductAddable(PRODUCT, IN_STOCK, MAX_BILL_LINES, 0);
      expect(full.ok === false && full.reason).toBe('LINE_LIMIT');
      expect(checkProductAddable(PRODUCT, IN_STOCK, MAX_BILL_LINES, 1).ok).toBeTrue();
    });

    it('names the available amount when a typed quantity is too high', () => {
      const result = checkQuantityAgainstStock('Amoxicillin 500mg', 200, {
        totalQuantity: 150,
        sellableQuantity: 150,
      });
      expect(result.ok === false && result.message).toBe(
        'Only 150 available for Amoxicillin 500mg.'
      );
      expect(
        checkQuantityAgainstStock('X', 150, { totalQuantity: 150, sellableQuantity: 150 }).ok
      ).toBeTrue();
    });
  });

  describe('hold and save readiness', () => {
    it('refuses an empty bill for hold and save', () => {
      expect(validateHold(0)?.code).toBe('EMPTY_BILL');
      expect(validateHold(1)).toBeNull();
      expect(readiness(0, 0, 0, false, false, [])?.code).toBe('EMPTY_BILL');
    });

    it('accepts full payment, split payment and cash with change', () => {
      expect(readiness(10_000, 0, 0, false, true)).toBeNull();
      expect(readiness(6000, 4000, 0, false, true)).toBeNull();
      expect(readiness(12_000, 0, 0, false, true)).toBeNull();
      expect(readiness(5000, 5000, 3000, false, true)).toBeNull();
    });

    it('refuses incomplete payment when there is no credit', () => {
      expect(readiness(9999, 0, 0, false, false)?.code).toBe('PAYMENT_INCOMPLETE');
      expect(readiness(0, 0, 0, false, false)?.code).toBe('PAYMENT_INCOMPLETE');
    });

    it('refuses extra card or online money, but allows extra cash', () => {
      expect(readiness(0, 10_001, 0, false, false)?.code).toBe('OVERPAID_NOT_CASH');
      expect(readiness(0, 5000, 5001, false, false)?.code).toBe('OVERPAID_NOT_CASH');
      expect(readiness(5000, 10_000, 0, false, false)).toBeNull();
    });

    it('allows Credit for a named customer for the unpaid part', () => {
      expect(readiness(3000, 0, 0, true, false)).toBeNull();
    });

    it('blocks Credit for the walk-in customer', () => {
      expect(readiness(3000, 0, 0, true, true)?.code).toBe('CREDIT_WALK_IN');
    });

    it('does not mind a Credit choice for walk-in once the bill is fully paid', () => {
      expect(readiness(10_000, 0, 0, true, true)).toBeNull();
    });
  });
});
