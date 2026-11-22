import {
  TEST_TODAY,
  testBatch,
  testProduct,
  testReturn,
  testSale,
  testSaleLine,
} from '../../../testing/pos-test.util';
import { ReturnSettlement } from '../models/enums/return-settlement.enum';
import {
  NOTHING_SELECTED_MESSAGE,
  WALK_IN_CREDIT_MESSAGE,
  buildReturnableLines,
  buildSaleReturn,
  effectiveLineTotalCents,
  normaliseLookup,
  parseReturnQuantity,
  returnItemCount,
  returnProfitCents,
  returnValueCents,
  selectReturn,
  settlementOptions,
  totalReturnedCents,
} from './pos-return.util';

const NAMED = { id: 'cus-002', name: 'Sunil Rathnayake', isWalkIn: false };
const WALK_IN = { id: 'cus-001', name: 'Walk-in Customer', isWalkIn: true };

function context(overrides: Partial<Parameters<typeof buildSaleReturn>[0]> = {}) {
  return {
    sale: testSale(),
    allReturns: [],
    products: [testProduct({ batches: [testBatch({ quantity: 95 })] })],
    customers: [WALK_IN, NAMED],
    quantities: { 'prod-001': '2' },
    settlement: ReturnSettlement.CASH_REFUND,
    blockExpired: true,
    today: TEST_TODAY,
    now: `${TEST_TODAY}T12:00:00`,
    processedBy: { id: 'usr-004', name: 'Ruwani Jayawardena' },
    ...overrides,
  };
}

describe('pos return util', () => {
  it('normalises a lookup to a trimmed, capped, upper case term', () => {
    expect(normaliseLookup('  inv-0001 ')).toBe('INV-0001');
    expect(normaliseLookup('x'.repeat(500))).toHaveSize(20);
  });

  describe('returnable quantity', () => {
    it('is sold minus already returned, never below zero', () => {
      const sale = testSale();
      const line = buildReturnableLines(sale, [testReturn()])[0];
      expect(line.soldQuantity).toBe(5);
      expect(line.returnedQuantity).toBe(2);
      expect(line.returnableQuantity).toBe(3);
    });

    it('ignores returns made against other sales', () => {
      const line = buildReturnableLines(testSale(), [
        testReturn({ originalSaleId: 'sale-009' }),
      ])[0];
      expect(line.returnableQuantity).toBe(5);
    });

    it('refuses 4 when 5 were sold and 2 already came back (AC-7)', () => {
      const line = buildReturnableLines(testSale(), [testReturn()])[0];
      const result = parseReturnQuantity('4', line);
      expect(result.ok).toBeFalse();
      expect(!result.ok && result.message).toContain('Only 3');
      expect(parseReturnQuantity('3', line)).toEqual({ ok: true, quantity: 3 });
    });

    it('treats blank as zero and refuses NaN, negative, decimal and huge input', () => {
      const line = buildReturnableLines(testSale(), [])[0];
      expect(parseReturnQuantity('  ', line)).toEqual({ ok: true, quantity: 0 });
      for (const bad of ['abc', '-1', '1.5', '1e3', '99999999999999999', 'NaN']) {
        expect(parseReturnQuantity(bad, line).ok).withContext(bad).toBeFalse();
      }
    });
  });

  describe('price actually charged', () => {
    it('uses the line total after the line discount', () => {
      const sale = testSale({
        lines: [testSaleLine({ discountPercent: 10, totalCents: 1125 })],
        subTotalCents: 1125,
        totalCents: 1125,
      });
      const line = buildReturnableLines(sale, [])[0];
      expect(line.unitPriceCents).toBe(225);
      expect(returnValueCents(line, 2)).toBe(450);
    });

    it('takes the bill discount share off the line', () => {
      const sale = testSale({ discountCents: 125, totalCents: 1125 });
      expect(effectiveLineTotalCents(sale, sale.lines[0])).toBe(1125);
    });

    it('values partial returns so the pieces never add up to more than the line', () => {
      const sale = testSale({
        lines: [testSaleLine({ quantity: 3, totalCents: 100 })],
        subTotalCents: 100,
        totalCents: 100,
      });
      const first = buildReturnableLines(sale, [])[0];
      const one = returnValueCents(first, 1);
      const afterOne = buildReturnableLines(sale, [
        testReturn({ lines: [{ ...testReturn().lines[0], quantity: 1, totalCents: one }] }),
      ])[0];
      const two = returnValueCents(afterOne, 2);
      expect(one + two).toBe(100);
    });
  });

  it('offers only a cash refund to the Walk-in Customer', () => {
    expect(settlementOptions(true)).toEqual([ReturnSettlement.CASH_REFUND]);
    expect(settlementOptions(false)).toEqual([
      ReturnSettlement.CASH_REFUND,
      ReturnSettlement.CUSTOMER_CREDIT,
    ]);
  });

  it('selects lines and totals them, reporting a bad quantity per line', () => {
    const lines = buildReturnableLines(testSale(), []);
    const selection = selectReturn(lines, { 'prod-001': '2' });
    expect(selection.totalCents).toBe(500);
    expect(selection.picks).toHaveSize(1);
    expect(selectReturn(lines, { 'prod-001': '9' }).errors['prod-001']).toContain('Only 5');
    expect(selectReturn(lines, {}).picks).toEqual([]);
  });

  describe('buildSaleReturn', () => {
    it('builds a return with its own number, the original invoice and the actor', () => {
      const result = buildSaleReturn(context());
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.saleReturn.returnNo).toBe('RET-0001');
      expect(result.saleReturn.originalInvoiceNo).toBe('INV-0001');
      expect(result.saleReturn.totalCents).toBe(500);
      expect(result.saleReturn.processedByName).toBe('Ruwani Jayawardena');
      expect(result.products[0].batches[0].quantity).toBe(97);
    });

    it('numbers the next return after the existing ones', () => {
      const result = buildSaleReturn(
        context({ allReturns: [testReturn()], quantities: { 'prod-001': '1' } })
      );
      expect(result.ok && result.saleReturn.returnNo).toBe('RET-0002');
    });

    it('refuses an empty selection', () => {
      const result = buildSaleReturn(context({ quantities: {} }));
      expect(result.ok).toBeFalse();
      expect(!result.ok && result.message).toBe(NOTHING_SELECTED_MESSAGE);
    });

    it('refuses more than is returnable from fresh returns', () => {
      const result = buildSaleReturn(
        context({ allReturns: [testReturn()], quantities: { 'prod-001': '4' } })
      );
      expect(result.ok).toBeFalse();
    });

    it('refuses credit for the Walk-in Customer', () => {
      const result = buildSaleReturn(context({ settlement: ReturnSettlement.CUSTOMER_CREDIT }));
      expect(!result.ok && result.message).toBe(WALK_IN_CREDIT_MESSAGE);
    });

    it('allows credit for a named customer', () => {
      const result = buildSaleReturn(
        context({
          sale: testSale({ customerId: NAMED.id, customerName: NAMED.name }),
          settlement: ReturnSettlement.CUSTOMER_CREDIT,
        })
      );
      expect(result.ok && result.saleReturn.settlement).toBe(ReturnSettlement.CUSTOMER_CREDIT);
    });

    it('refuses when the product is gone', () => {
      const result = buildSaleReturn(context({ products: [] }));
      expect(result.ok).toBeFalse();
    });
  });

  it('counts the profit given back as the refund less the cost of the stock returned', () => {
    expect(returnProfitCents(testReturn())).toBe(300);
    expect(returnItemCount(testReturn())).toBe(2);
    expect(totalReturnedCents([testReturn()], 'sale-001')).toBe(500);
    expect(totalReturnedCents([testReturn()], 'sale-002')).toBe(0);
  });
});
