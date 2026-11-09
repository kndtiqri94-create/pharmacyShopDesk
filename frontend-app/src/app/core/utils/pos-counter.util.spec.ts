import {
  BROUGHT_FORWARD_TOO_HIGH_MESSAGE,
  COUNTER_NOTE_MAX_LENGTH,
  CounterCloseText,
  HANDOVER_ABOVE_COUNTED_MESSAGE,
  SUPERVISOR_REQUIRED_MESSAGE,
  canComplete,
  cleanCounterNote,
  counterDifferenceCents,
  counterOutcome,
  defaultBroughtForwardCents,
  isSupervisorRequired,
  parseCountedCents,
  parseHandoverCents,
  unaccountedCents,
  validateBroughtForward,
  validateCounterClose,
  validateHandover,
} from './pos-counter.util';

describe('pos counter util', () => {
  it('labels the difference in words', () => {
    expect(counterOutcome(counterDifferenceCents(10_100, 10_000))).toBe('OVER');
    expect(counterOutcome(counterDifferenceCents(9_900, 10_000))).toBe('SHORT');
    expect(counterOutcome(counterDifferenceCents(10_000, 10_000))).toBe('BALANCED');
  });

  it('parses a counted amount with up to two decimals', () => {
    expect(parseCountedCents('0')).toEqual({ ok: true, cents: 0 });
    expect(parseCountedCents('12500.50')).toEqual({ ok: true, cents: 1_250_050 });
    expect(parseCountedCents(' 100 ')).toEqual({ ok: true, cents: 10_000 });
  });

  it('refuses blank, negative, non numeric and three decimal amounts', () => {
    for (const bad of ['', '  ', '-5', 'abc', '1.234', '1e5', 'NaN', '9'.repeat(20)]) {
      expect(parseCountedCents(bad).ok).withContext(bad).toBeFalse();
    }
  });

  it('trims and caps the note', () => {
    expect(cleanCounterNote('  short  ')).toBe('short');
    expect(cleanCounterNote('x'.repeat(1000))).toHaveSize(COUNTER_NOTE_MAX_LENGTH);
  });

  describe('handover', () => {
    it('treats blank as no handover and parses up to two decimals', () => {
      expect(parseHandoverCents('')).toEqual({ ok: true, cents: 0 });
      expect(parseHandoverCents(' 250.5 ')).toEqual({ ok: true, cents: 25_050 });
    });

    it('refuses negative, non numeric and three decimal handovers', () => {
      for (const bad of ['-1', 'abc', 'NaN', '1.234', 'Infinity', '1e3']) {
        expect(parseHandoverCents(bad).ok).withContext(bad).toBeFalse();
      }
    });

    it('allows zero, an amount equal to the count, and refuses one cent above it', () => {
      expect(validateHandover(10_000, '0')).toEqual({ ok: true, cents: 0 });
      expect(validateHandover(10_000, '100')).toEqual({ ok: true, cents: 10_000 });
      const above = validateHandover(10_000, '100.01');
      expect(above.ok).toBeFalse();
      expect(!above.ok && above.message).toBe(HANDOVER_ABOVE_COUNTED_MESSAGE);
    });

    it('needs a supervisor only when the handover is above zero', () => {
      expect(isSupervisorRequired(0)).toBeFalse();
      expect(isSupervisorRequired(1)).toBeTrue();
    });
  });

  describe('brought forward', () => {
    it('defaults to the count less the handover and never below zero', () => {
      expect(defaultBroughtForwardCents(10_000, 2_500)).toBe(7_500);
      expect(defaultBroughtForwardCents(10_000, 10_000)).toBe(0);
      expect(defaultBroughtForwardCents(1_000, 5_000)).toBe(0);
    });

    it('uses the default when no text is given', () => {
      expect(validateBroughtForward(10_000, 2_500, null)).toEqual({ ok: true, cents: 7_500 });
    });

    it('accepts the bound and refuses one cent over', () => {
      expect(validateBroughtForward(10_000, 2_500, '75')).toEqual({ ok: true, cents: 7_500 });
      const over = validateBroughtForward(10_000, 2_500, '75.01');
      expect(over.ok).toBeFalse();
      expect(!over.ok && over.message).toBe(BROUGHT_FORWARD_TOO_HIGH_MESSAGE);
    });

    it('refuses negative and non numeric text', () => {
      for (const bad of ['-1', 'abc', '1.234']) {
        expect(validateBroughtForward(10_000, 0, bad).ok)
          .withContext(bad)
          .toBeFalse();
      }
    });

    it('reports the unaccounted remainder, zero when everything is accounted for', () => {
      expect(unaccountedCents(10_000, 2_500, 7_500)).toBe(0);
      expect(unaccountedCents(10_000, 2_500, 5_000)).toBe(2_500);
    });
  });

  describe('canComplete', () => {
    it('is false until a valid count is entered, and false again when cleared', () => {
      expect(canComplete('')).toBeFalse();
      expect(canComplete('abc')).toBeFalse();
      expect(canComplete('-1')).toBeFalse();
      expect(canComplete('0')).toBeTrue();
      expect(canComplete('1250.50')).toBeTrue();
      expect(canComplete('  ')).toBeFalse();
    });
  });

  describe('validateCounterClose', () => {
    const base: CounterCloseText = {
      countedText: '1000',
      handoverText: '',
      supervisorUserId: null,
      broughtForwardText: null,
    };

    it('accepts a count with no handover and defaults the balance forward', () => {
      const result = validateCounterClose(base);
      expect(result).toEqual({
        ok: true,
        amounts: {
          countedCents: 100_000,
          handoverCents: 0,
          broughtForwardCents: 100_000,
          unaccountedCents: 0,
          supervisorUserId: null,
        },
      });
    });

    it('refuses a bad count first', () => {
      const result = validateCounterClose({ ...base, countedText: '-5' });
      expect(!result.ok && result.field).toBe('counted');
    });

    it('refuses a handover above zero without a supervisor', () => {
      const result = validateCounterClose({ ...base, handoverText: '200' });
      expect(!result.ok && result.field).toBe('supervisor');
      expect(!result.ok && result.message).toBe(SUPERVISOR_REQUIRED_MESSAGE);
    });

    it('refuses a handover above the count', () => {
      const result = validateCounterClose({
        ...base,
        handoverText: '1000.01',
        supervisorUserId: 'usr-1',
      });
      expect(!result.ok && result.field).toBe('handover');
    });

    it('refuses a balance brought forward that breaks the bound', () => {
      const result = validateCounterClose({
        ...base,
        handoverText: '200',
        supervisorUserId: 'usr-1',
        broughtForwardText: '800.01',
      });
      expect(!result.ok && result.field).toBe('broughtForward');
    });

    it('records the supervisor and the unaccounted remainder', () => {
      const result = validateCounterClose({
        ...base,
        handoverText: '200',
        supervisorUserId: 'usr-1',
        broughtForwardText: '600',
      });
      expect(result.ok && result.amounts.supervisorUserId).toBe('usr-1');
      expect(result.ok && result.amounts.unaccountedCents).toBe(20_000);
    });

    it('drops a supervisor when there is no handover', () => {
      const result = validateCounterClose({ ...base, supervisorUserId: 'usr-1' });
      expect(result.ok && result.amounts.supervisorUserId).toBeNull();
    });

    it('does not take expected cash, so the handover cannot change the difference', () => {
      const withHandover = validateCounterClose({
        ...base,
        handoverText: '300',
        supervisorUserId: 'usr-1',
      });
      const without = validateCounterClose(base);
      const counted = (value: typeof withHandover) => (value.ok ? value.amounts.countedCents : -1);
      expect(counterOutcome(counterDifferenceCents(counted(withHandover), 100_000))).toBe(
        counterOutcome(counterDifferenceCents(counted(without), 100_000))
      );
    });
  });
});
