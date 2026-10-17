import { ReloadFloat } from '../models/domain/reload-float.model';
import { ReloadTransaction } from '../models/domain/reload-transaction.model';
import { addSeconds } from './date.util';
import { formatRupees } from './money.util';
import { FLOAT_FULL_CENTS } from './reload-commission.util';

export function currentFloat(history: readonly ReloadFloat[]): ReloadFloat | null {
  return history.reduce<ReloadFloat | null>(
    (latest, entry) => (latest === null || entry.date > latest.date ? entry : latest),
    null
  );
}

export function isFloatLow(float: ReloadFloat | null, lowFloatCents: number): boolean {
  return float !== null && float.availableCents < lowFloatCents;
}

export function floatWarningText(lowFloatCents: number): string {
  return `Float is below ${formatRupees(lowFloatCents)}. Top up before the evening rush.`;
}

export function floatProgressValue(availableCents: number): number {
  return Math.min(Math.max(0, availableCents), FLOAT_FULL_CENTS);
}

export function sortTransactionsNewestFirst(
  transactions: readonly ReloadTransaction[]
): ReloadTransaction[] {
  return transactions
    .map((transaction, index) => ({ transaction, index }))
    .sort((first, second) =>
      first.transaction.occurredAt === second.transaction.occurredAt
        ? second.index - first.index
        : second.transaction.occurredAt.localeCompare(first.transaction.occurredAt)
    )
    .map(item => item.transaction);
}

export function nextOccurredAt(now: string, existing: readonly ReloadTransaction[]): string {
  const latest = existing.reduce<string | null>(
    (highest, transaction) =>
      highest === null || transaction.occurredAt > highest ? transaction.occurredAt : highest,
    null
  );
  return latest !== null && now <= latest ? addSeconds(latest, 1) : now;
}
