import {
  CurrencyDenomination,
  DenominationKind,
} from '../models/domain/currency-denomination.model';
import { formatCount } from './money.util';
import { MAX_PRICE_RUPEES } from './product-validation.util';

export const MAX_DENOMINATION_COUNT = 100_000;
export const DENOMINATION_COUNT_ERROR = 'Enter a whole number from 0 to 100,000.';
export const DENOMINATION_TOTAL_ERROR = 'The total is too large. Check the counts.';

const COUNT_DIGIT_LIMIT = 6;
const DIGITS_ONLY = /^\d+$/;

export const LKR_DENOMINATIONS: readonly CurrencyDenomination[] = [
  { valueRupees: 5000, kind: 'NOTE' },
  { valueRupees: 2000, kind: 'NOTE' },
  { valueRupees: 1000, kind: 'NOTE' },
  { valueRupees: 500, kind: 'NOTE' },
  { valueRupees: 100, kind: 'NOTE' },
  { valueRupees: 50, kind: 'NOTE' },
  { valueRupees: 20, kind: 'NOTE' },
  { valueRupees: 10, kind: 'COIN' },
  { valueRupees: 5, kind: 'COIN' },
  { valueRupees: 2, kind: 'COIN' },
  { valueRupees: 1, kind: 'COIN' },
];

export interface DenominationEntry {
  denomination: CurrencyDenomination;
  label: string;
  count: number;
  lineCents: number;
  error: string | null;
}

export interface DenominationSummary {
  entries: DenominationEntry[];
  totalCents: number;
  totalError: string | null;
  valid: boolean;
}

const KIND_WORDS: Record<DenominationKind, string> = { NOTE: 'note', COIN: 'coin' };

export function denominationLabel(denomination: CurrencyDenomination): string {
  return `Rs. ${formatCount(denomination.valueRupees)} ${KIND_WORDS[denomination.kind]}`;
}

export function parseDenominationCount(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  if (trimmed.length > COUNT_DIGIT_LIMIT || !DIGITS_ONLY.test(trimmed)) return null;
  const count = Number(trimmed);
  return count > MAX_DENOMINATION_COUNT ? null : count;
}

export function denominationLineCents(denomination: CurrencyDenomination, count: number): number {
  return denomination.valueRupees * count * 100;
}

function buildEntry(denomination: CurrencyDenomination, text: string): DenominationEntry {
  const count = parseDenominationCount(text);
  const label = denominationLabel(denomination);
  if (count === null) {
    return { denomination, label, count: 0, lineCents: 0, error: DENOMINATION_COUNT_ERROR };
  }
  return {
    denomination,
    label,
    count,
    lineCents: denominationLineCents(denomination, count),
    error: null,
  };
}

export function summarizeDenominations(
  texts: Readonly<Record<number, string>>
): DenominationSummary {
  const entries = LKR_DENOMINATIONS.map(item => buildEntry(item, texts[item.valueRupees] ?? ''));
  const totalCents = entries.reduce((total, item) => total + item.lineCents, 0);
  const totalError = totalCents > MAX_PRICE_RUPEES * 100 ? DENOMINATION_TOTAL_ERROR : null;
  const valid = totalError === null && entries.every(item => item.error === null);
  return { entries, totalCents, totalError, valid };
}
