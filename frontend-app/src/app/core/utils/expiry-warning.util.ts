import { monthsBetween, parseExpiryInput } from './date.util';
import { pluralize } from './text.util';

export const EXPIRY_WARNING_MONTHS = 6;

export interface ExpiryWarningLine {
  productName: string;
  expiry: string;
}

export interface ExpiryWarning {
  lineIndex: number;
  message: string;
}

export function isShortDated(expiry: string, today: string): boolean {
  const iso = parseExpiryInput(expiry);
  return iso !== null && monthsBetween(today, iso) < EXPIRY_WARNING_MONTHS;
}

function describeWarning(line: ExpiryWarningLine, today: string): string {
  const iso = parseExpiryInput(line.expiry) ?? '';
  const months = monthsBetween(today, iso);
  const expiry = line.expiry.trim();
  const advice = 'Check with the supplier before accepting.';
  if (iso < today) {
    return `${line.productName} is already past its expiry date (${expiry}). ${advice}`;
  }
  if (months <= 0) return `${line.productName} expires this month (${expiry}). ${advice}`;
  return `${line.productName} expires in ${pluralize(months, 'month')} (${expiry}). ${advice}`;
}

export function findExpiryWarnings(
  lines: readonly ExpiryWarningLine[],
  today: string
): ExpiryWarning[] {
  return lines
    .map((line, lineIndex) => ({ line, lineIndex }))
    .filter(({ line }) => isShortDated(line.expiry, today))
    .map(({ line, lineIndex }) => ({ lineIndex, message: describeWarning(line, today) }));
}
