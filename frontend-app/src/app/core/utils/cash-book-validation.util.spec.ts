import {
  MAX_ADJUSTMENT_NOTE_LENGTH,
  MAX_RANGE_DAYS,
  datesInRange,
  parseAdjustment,
  parseCountedAmount,
  validateDateRange,
} from './cash-book-validation.util';

describe('cash-book-validation.util', () => {
  const today = '2026-09-21';

  describe('validateDateRange', () => {
    it('accepts one day and a normal range ending today', () => {
      expect(validateDateRange(today, today, today).ok).toBeTrue();
      expect(validateDateRange('2026-09-01', today, today).ok).toBeTrue();
    });

    it('refuses reversed, future, malformed and empty dates', () => {
      expect(validateDateRange('2026-09-21', '2026-09-20', today).ok).toBeFalse();
      expect(validateDateRange('2026-09-21', '2026-09-22', today).ok).toBeFalse();
      expect(validateDateRange('2026-13-01', today, today).ok).toBeFalse();
      expect(validateDateRange('', '', today).ok).toBeFalse();
    });

    it('allows the widest span and refuses one day more', () => {
      expect(validateDateRange('2026-06-22', today, today).ok).toBeTrue();
      expect(validateDateRange('2026-06-21', today, today).ok).toBeFalse();
      expect(MAX_RANGE_DAYS).toBe(92);
    });
  });

  it('lists every day of a range and caps the list', () => {
    expect(datesInRange('2026-09-19', '2026-09-21')).toEqual([
      '2026-09-19',
      '2026-09-20',
      '2026-09-21',
    ]);
    expect(datesInRange('2025-01-01', '2026-09-21')).toHaveSize(MAX_RANGE_DAYS);
  });

  describe('parseCountedAmount', () => {
    it('accepts zero and two decimals', () => {
      expect(parseCountedAmount('0')).toEqual({ ok: true, cents: 0 });
      expect(parseCountedAmount('5000.50')).toEqual({ ok: true, cents: 500_050 });
    });

    it('refuses empty, negative, text, three decimals and huge values', () => {
      for (const bad of ['', ' ', '-1', 'abc', 'NaN', 'Infinity', '1.234', '1e3', '99999999999']) {
        expect(parseCountedAmount(bad).ok).withContext(bad).toBeFalse();
      }
    });
  });

  describe('parseAdjustment', () => {
    it('accepts a positive and a negative amount with a note', () => {
      expect(parseAdjustment('250.50', ' Found cash ')).toEqual({
        ok: true,
        signedCents: 25_050,
        note: 'Found cash',
      });
      expect(parseAdjustment('-100', 'Short')).toEqual({
        ok: true,
        signedCents: -10_000,
        note: 'Short',
      });
    });

    it('refuses a missing note and a zero or non numeric amount', () => {
      const noNote = parseAdjustment('10', '   ');
      expect(noNote.ok ? null : noNote.errors.note).toBeTruthy();
      for (const bad of ['', '0', '-0', 'abc', '+-5', '--5', '1.234', 'NaN']) {
        const result = parseAdjustment(bad, 'note');
        expect(result.ok).withContext(bad).toBeFalse();
        expect(result.ok ? null : result.errors.amount)
          .withContext(bad)
          .toBeTruthy();
      }
    });

    it('refuses an oversized note', () => {
      const long = 'x'.repeat(MAX_ADJUSTMENT_NOTE_LENGTH + 1);
      expect(parseAdjustment('10', long).ok).toBeFalse();
      expect(parseAdjustment('10', 'x'.repeat(MAX_ADJUSTMENT_NOTE_LENGTH)).ok).toBeTrue();
    });
  });
});
