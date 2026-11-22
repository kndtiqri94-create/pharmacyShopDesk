import { TEST_TODAY, testBatch, testBillLine, testProduct } from '../../../testing/pos-test.util';
import {
  applyProductUpdate,
  diffProductUpdate,
  parseStockFigure,
  recheckBillLines,
  validateProductUpdate,
} from './pos-product-update.util';
import { getStockOnHand } from './stock-status.util';

const batched = () =>
  testProduct({
    batches: [
      testBatch({ id: 'bat-a', expiryDate: '2027-01-31', quantity: 10 }),
      testBatch({ id: 'bat-b', expiryDate: '2028-01-31', quantity: 20 }),
    ],
  });

describe('pos product update util', () => {
  it('accepts a price of zero or more and a whole stock figure', () => {
    expect(validateProductUpdate('0', '0').values).toEqual({ priceCents: 0, stock: 0 });
    expect(validateProductUpdate('275.50', '40').values).toEqual({ priceCents: 27_550, stock: 40 });
  });

  it('refuses a negative, blank or non numeric price with a message', () => {
    for (const bad of ['-1', '', 'abc', 'NaN', '1.999']) {
      const result = validateProductUpdate(bad, '5');
      expect(result.values).withContext(bad).toBeNull();
      expect(result.errors.price).withContext(bad).toBeDefined();
    }
  });

  it('refuses a negative, fractional, blank or non numeric stock figure', () => {
    for (const bad of ['-1', '2.5', '', 'abc', 'NaN', '99999999999']) {
      const result = validateProductUpdate('10', bad);
      expect(result.values).withContext(bad).toBeNull();
      expect(result.errors.stock).withContext(bad).toBeDefined();
    }
    expect(parseStockFigure('12')).toBe(12);
  });

  it('shows what changed with old and new values', () => {
    const diff = diffProductUpdate(batched(), { priceCents: 300, stock: 25 });
    expect(diff).toEqual({
      priceChanged: true,
      stockChanged: true,
      oldPriceCents: 250,
      newPriceCents: 300,
      oldStock: 30,
      newStock: 25,
    });
    expect(diffProductUpdate(batched(), { priceCents: 250, stock: 30 }).priceChanged).toBeFalse();
  });

  describe('applying the change', () => {
    it('sets the stock figure of a product without batches', () => {
      const product = testProduct({ trackBatches: false, batches: [], stockOnHand: 7 });
      const updated = applyProductUpdate(product, { priceCents: 100, stock: 3 }, TEST_TODAY);
      expect(updated.stockOnHand).toBe(3);
      expect(updated.priceCents).toBe(100);
    });

    it('adds extra stock to the batch that sells first', () => {
      const updated = applyProductUpdate(batched(), { priceCents: 250, stock: 35 }, TEST_TODAY);
      expect(updated.batches.find(batch => batch.id === 'bat-a')?.quantity).toBe(15);
      expect(getStockOnHand(updated)).toBe(35);
    });

    it('takes removed stock from the earliest batches first without going below zero', () => {
      const updated = applyProductUpdate(batched(), { priceCents: 250, stock: 5 }, TEST_TODAY);
      expect(updated.batches.find(batch => batch.id === 'bat-a')?.quantity).toBe(0);
      expect(updated.batches.find(batch => batch.id === 'bat-b')?.quantity).toBe(5);
      expect(getStockOnHand(updated)).toBe(5);
    });

    it('leaves the original product untouched', () => {
      const product = batched();
      applyProductUpdate(product, { priceCents: 1, stock: 0 }, TEST_TODAY);
      expect(getStockOnHand(product)).toBe(30);
      expect(product.priceCents).toBe(250);
    });
  });

  describe('re-checking a bill', () => {
    it('updates the price and says so', () => {
      const result = recheckBillLines(
        [testBillLine('prod-001', 2)],
        [testProduct({ priceCents: 300 })],
        TEST_TODAY,
        true
      );
      expect(result.lines[0].unitPriceCents).toBe(300);
      expect(result.notes.join(' ')).toContain('Rs. 3.00');
    });

    it('flags a line that now has too little stock', () => {
      const result = recheckBillLines(
        [testBillLine('prod-001', 50)],
        [testProduct({ batches: [testBatch({ quantity: 10 })] })],
        TEST_TODAY,
        true
      );
      expect(result.notes.join(' ')).toContain('Only 10');
    });

    it('flags a line whose product is no longer for sale', () => {
      const result = recheckBillLines(
        [testBillLine('prod-001', 1)],
        [testProduct({ active: false })],
        TEST_TODAY,
        true
      );
      expect(result.notes).toHaveSize(1);
    });

    it('has no notes when nothing is wrong', () => {
      const result = recheckBillLines(
        [testBillLine('prod-001', 2)],
        [testProduct()],
        TEST_TODAY,
        true
      );
      expect(result.notes).toEqual([]);
    });
  });
});
