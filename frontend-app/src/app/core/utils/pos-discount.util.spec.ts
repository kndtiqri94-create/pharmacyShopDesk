import { BillLine } from '../models/domain/bill-line.model';
import { DiscountApproval } from '../models/domain/discount-approval.model';
import { PosSettings } from '../models/domain/pos-settings.model';
import {
  decideBillDiscount,
  decideLineDiscount,
  defaultBillDiscount,
  defaultLineDiscountPercent,
  findDiscountProblem,
  parseDiscountPercent,
} from './pos-discount.util';

const SETTINGS: PosSettings = {
  lineDiscountEnabled: true,
  billDiscountEnabled: true,
  defaultDiscountPercent: 0,
  maxDiscountPercent: 20,
  hideSidebarOnOpen: true,
};

const approval = (overrides: Partial<DiscountApproval> = {}): DiscountApproval => ({
  scope: 'LINE',
  productId: 'prod-001',
  percent: 10,
  approverUserId: 'usr-001',
  approverName: 'Nimal Perera',
  approvedAt: '2026-09-21T10:00:00',
  ...overrides,
});

const line = (overrides: Partial<BillLine> = {}): BillLine => ({
  productId: 'prod-001',
  sku: 'PAR-500',
  name: 'Paracetamol 500mg',
  barcode: '1',
  unitPriceCents: 250,
  discountPercent: 0,
  quantity: 1,
  discountApproval: null,
  ...overrides,
});

describe('pos discount', () => {
  describe('parseDiscountPercent', () => {
    it('accepts 0 to 100 with up to two decimals', () => {
      expect(parseDiscountPercent('0')).toBe(0);
      expect(parseDiscountPercent('12.5')).toBe(12.5);
      expect(parseDiscountPercent('12.55')).toBe(12.55);
      expect(parseDiscountPercent('100')).toBe(100);
      expect(parseDiscountPercent(' 7 ')).toBe(7);
      expect(parseDiscountPercent('7.')).toBe(7);
    });

    it('refuses negatives, words, too many decimals, above 100 and long text', () => {
      for (const text of [
        '',
        ' ',
        '-1',
        'abc',
        '1e3',
        '5.555',
        '100.01',
        '101',
        '1,5',
        '0.0000001',
        '..',
      ]) {
        expect(parseDiscountPercent(text)).withContext(text).toBeNull();
      }
      expect(parseDiscountPercent('1'.repeat(50))).toBeNull();
    });
  });

  describe('line discount decision', () => {
    it('needs nothing at the default', () => {
      expect(decideLineDiscount(0, SETTINGS)).toEqual({ kind: 'NONE_NEEDED' });
      expect(decideLineDiscount(5, { ...SETTINGS, defaultDiscountPercent: 5 })).toEqual({
        kind: 'NONE_NEEDED',
      });
    });

    it('needs approval for any other value up to the maximum, even exactly the maximum', () => {
      expect(decideLineDiscount(0.01, SETTINGS).kind).toBe('NEEDS_APPROVAL');
      expect(decideLineDiscount(20, SETTINGS).kind).toBe('NEEDS_APPROVAL');
    });

    it('refuses above the maximum with no approval path', () => {
      const decision = decideLineDiscount(20.01, SETTINGS);
      expect(decision.kind).toBe('REFUSED');
      if (decision.kind === 'REFUSED') {
        expect(decision.reason).toBe('ABOVE_MAXIMUM');
        expect(decision.message).toContain('20%');
      }
    });

    it('refuses numbers that are not valid', () => {
      expect(decideLineDiscount(null, SETTINGS).kind).toBe('REFUSED');
      expect(decideLineDiscount(Number.NaN, SETTINGS).kind).toBe('REFUSED');
      expect(decideLineDiscount(-1, SETTINGS).kind).toBe('REFUSED');
    });

    it('refuses when line discount is off in Settings', () => {
      const decision = decideLineDiscount(5, { ...SETTINGS, lineDiscountEnabled: false });
      expect(decision.kind === 'REFUSED' && decision.reason).toBe('DISABLED');
    });
  });

  describe('bill discount decision', () => {
    it('needs nothing at the default percentage and approval for others', () => {
      expect(decideBillDiscount({ mode: 'PERCENT', percent: 0 }, 10_000, SETTINGS).kind).toBe(
        'NONE_NEEDED'
      );
      expect(decideBillDiscount({ mode: 'PERCENT', percent: 5 }, 10_000, SETTINGS).kind).toBe(
        'NEEDS_APPROVAL'
      );
    });

    it('refuses a percentage above the maximum', () => {
      const decision = decideBillDiscount({ mode: 'PERCENT', percent: 25 }, 10_000, SETTINGS);
      expect(decision.kind === 'REFUSED' && decision.reason).toBe('ABOVE_MAXIMUM');
    });

    it('judges an amount against the sub total, the maximum and the default', () => {
      expect(decideBillDiscount({ mode: 'AMOUNT', cents: 0 }, 10_000, SETTINGS).kind).toBe(
        'NONE_NEEDED'
      );
      expect(decideBillDiscount({ mode: 'AMOUNT', cents: 2000 }, 10_000, SETTINGS).kind).toBe(
        'NEEDS_APPROVAL'
      );
      const aboveMax = decideBillDiscount({ mode: 'AMOUNT', cents: 2001 }, 10_000, SETTINGS);
      expect(aboveMax.kind === 'REFUSED' && aboveMax.reason).toBe('ABOVE_MAXIMUM');
      const aboveSub = decideBillDiscount({ mode: 'AMOUNT', cents: 10_001 }, 10_000, SETTINGS);
      expect(aboveSub.kind === 'REFUSED' && aboveSub.reason).toBe('ABOVE_SUB_TOTAL');
    });

    it('refuses an invalid amount', () => {
      expect(decideBillDiscount({ mode: 'AMOUNT', cents: -1 }, 10_000, SETTINGS).kind).toBe(
        'REFUSED'
      );
      expect(decideBillDiscount({ mode: 'AMOUNT', cents: 1.5 }, 10_000, SETTINGS).kind).toBe(
        'REFUSED'
      );
      expect(decideBillDiscount(null, 10_000, SETTINGS).kind).toBe('REFUSED');
    });

    it('refuses when bill discount is off in Settings', () => {
      const decision = decideBillDiscount({ mode: 'PERCENT', percent: 1 }, 10_000, {
        ...SETTINGS,
        billDiscountEnabled: false,
      });
      expect(decision.kind === 'REFUSED' && decision.reason).toBe('DISABLED');
    });
  });

  describe('defaults', () => {
    it('start lines and the bill at the Settings default, or zero when switched off', () => {
      const withDefault = { ...SETTINGS, defaultDiscountPercent: 5 };
      expect(defaultLineDiscountPercent(withDefault)).toBe(5);
      expect(defaultBillDiscount(withDefault)).toEqual({ mode: 'PERCENT', percent: 5 });
      expect(defaultLineDiscountPercent({ ...withDefault, lineDiscountEnabled: false })).toBe(0);
      expect(defaultBillDiscount({ ...withDefault, billDiscountEnabled: false })).toEqual({
        mode: 'PERCENT',
        percent: 0,
      });
    });
  });

  describe('findDiscountProblem at save time', () => {
    const noBillDiscount = defaultBillDiscount(SETTINGS);

    it('finds nothing wrong with default discounts', () => {
      expect(findDiscountProblem([line()], noBillDiscount, null, 1000, SETTINGS)).toBeNull();
    });

    it('accepts an approved line discount and rejects an unapproved one', () => {
      const approved = line({ discountPercent: 10, discountApproval: approval() });
      expect(findDiscountProblem([approved], noBillDiscount, null, 1000, SETTINGS)).toBeNull();
      const unapproved = line({ discountPercent: 10 });
      expect(findDiscountProblem([unapproved], noBillDiscount, null, 1000, SETTINGS)).toContain(
        'approval'
      );
    });

    it('rejects an approval that belongs to another product or another value', () => {
      const otherProduct = line({
        discountPercent: 10,
        discountApproval: approval({ productId: 'prod-002' }),
      });
      const otherValue = line({
        discountPercent: 12,
        discountApproval: approval({ percent: 10 }),
      });
      expect(
        findDiscountProblem([otherProduct], noBillDiscount, null, 1000, SETTINGS)
      ).not.toBeNull();
      expect(
        findDiscountProblem([otherValue], noBillDiscount, null, 1000, SETTINGS)
      ).not.toBeNull();
    });

    it('rejects a line discount above the maximum even with an approval', () => {
      const tooHigh = line({
        discountPercent: 30,
        discountApproval: approval({ percent: 30 }),
      });
      expect(findDiscountProblem([tooHigh], noBillDiscount, null, 1000, SETTINGS)).toContain('20%');
    });

    it('rejects a line discount when line discount is off', () => {
      const stray = line({ discountPercent: 5, discountApproval: approval({ percent: 5 }) });
      expect(
        findDiscountProblem([stray], noBillDiscount, null, 1000, {
          ...SETTINGS,
          lineDiscountEnabled: false,
        })
      ).toContain('turned off');
    });

    it('needs a matching approval for a bill discount', () => {
      const discount = { mode: 'PERCENT', percent: 10 } as const;
      expect(findDiscountProblem([line()], discount, null, 1000, SETTINGS)).toContain('approval');
      const billApproval = approval({ scope: 'BILL', productId: null, percent: 10 });
      expect(findDiscountProblem([line()], discount, billApproval, 1000, SETTINGS)).toBeNull();
      const stale = approval({ scope: 'BILL', productId: null, percent: 5 });
      expect(findDiscountProblem([line()], discount, stale, 1000, SETTINGS)).not.toBeNull();
    });

    it('treats an amount approval as stale when the sub total changed', () => {
      const discount = { mode: 'AMOUNT', cents: 100 } as const;
      const billApproval = approval({ scope: 'BILL', productId: null, percent: 10 });
      expect(findDiscountProblem([line()], discount, billApproval, 1000, SETTINGS)).toBeNull();
      expect(findDiscountProblem([line()], discount, billApproval, 2000, SETTINGS)).not.toBeNull();
    });

    it('refuses a bill discount above the maximum or the sub total', () => {
      expect(
        findDiscountProblem([line()], { mode: 'PERCENT', percent: 50 }, null, 1000, SETTINGS)
      ).toContain('20%');
      expect(
        findDiscountProblem([line()], { mode: 'AMOUNT', cents: 5000 }, null, 1000, SETTINGS)
      ).toContain('sub total');
    });
  });
});
