import { ReloadFloat } from '../models/domain/reload-float.model';
import { ReloadTransaction } from '../models/domain/reload-transaction.model';
import { ReloadStatus } from '../models/enums/reload-status.enum';
import { ReloadTransactionType } from '../models/enums/reload-transaction-type.enum';
import {
  currentFloat,
  floatProgressValue,
  floatWarningText,
  isFloatLow,
  nextOccurredAt,
  sortTransactionsNewestFirst,
} from './reload-summary.util';

function floatOn(date: string, availableCents: number): ReloadFloat {
  return { date, availableCents, reloadsCount: 0, billsCount: 0, commissionCents: 0 };
}

function transaction(id: string, occurredAt: string): ReloadTransaction {
  return {
    id,
    occurredAt,
    provider: 'Dialog',
    type: ReloadTransactionType.RELOAD,
    reference: '077 123 4567',
    amountCents: 1000,
    commissionCents: 25,
    status: ReloadStatus.SUCCESS,
  };
}

describe('reload summary', () => {
  it('picks the latest dated float, whatever the list order', () => {
    const history = [floatOn('2026-09-21', 3), floatOn('2026-09-19', 1), floatOn('2026-09-20', 2)];
    expect(currentFloat(history)?.availableCents).toBe(3);
    expect(currentFloat([])).toBeNull();
  });

  it('is low only when strictly below the level', () => {
    expect(isFloatLow(floatOn('d', 999_999), 1_000_000)).toBeTrue();
    expect(isFloatLow(floatOn('d', 1_000_000), 1_000_000)).toBeFalse();
    expect(isFloatLow(floatOn('d', 1_000_001), 1_000_000)).toBeFalse();
    expect(isFloatLow(floatOn('d', 0), 0)).toBeFalse();
    expect(isFloatLow(null, 1_000_000)).toBeFalse();
  });

  it('words the warning with the current level', () => {
    expect(floatWarningText(1_000_000)).toBe(
      'Float is below Rs. 10,000. Top up before the evening rush.'
    );
    expect(floatWarningText(1_250_050)).toBe(
      'Float is below Rs. 12,500.50. Top up before the evening rush.'
    );
  });

  it('caps the progress at a full float and never goes below zero', () => {
    expect(floatProgressValue(620_000)).toBe(620_000);
    expect(floatProgressValue(2_000_000)).toBe(2_000_000);
    expect(floatProgressValue(5_000_000)).toBe(2_000_000);
    expect(floatProgressValue(-5)).toBe(0);
  });

  it('lists the newest first and puts the later of two equal times on top', () => {
    const sorted = sortTransactionsNewestFirst([
      transaction('a', '2026-09-21T09:12:00'),
      transaction('c', '2026-09-21T10:52:00'),
      transaction('b', '2026-09-21T10:52:00'),
    ]);
    expect(sorted.map(item => item.id)).toEqual(['b', 'c', 'a']);
  });

  it('does not change the list it is given', () => {
    const original = [
      transaction('a', '2026-09-21T09:12:00'),
      transaction('b', '2026-09-21T10:00:00'),
    ];
    sortTransactionsNewestFirst(original);
    expect(original.map(item => item.id)).toEqual(['a', 'b']);
  });

  it('keeps a new row after the newest existing one even when the clock is earlier', () => {
    const existing = [transaction('a', '2026-09-21T10:52:00')];
    expect(nextOccurredAt('2026-09-21T08:00:00', existing)).toBe('2026-09-21T10:52:01');
    expect(nextOccurredAt('2026-09-21T10:52:00', existing)).toBe('2026-09-21T10:52:01');
    expect(nextOccurredAt('2026-09-21T14:30:05', existing)).toBe('2026-09-21T14:30:05');
    expect(nextOccurredAt('2026-09-21T08:00:00', [])).toBe('2026-09-21T08:00:00');
  });
});
