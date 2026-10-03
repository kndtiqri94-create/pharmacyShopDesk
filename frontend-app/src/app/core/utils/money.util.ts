const WHOLE_NUMBER_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const TWO_DECIMAL_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function rupeesToCents(rupees: number): number {
  return Math.round(rupees * 100);
}

export function formatRupees(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const hasFraction = absolute % 100 !== 0;
  const formatter = hasFraction ? TWO_DECIMAL_FORMAT : WHOLE_NUMBER_FORMAT;
  return `${sign}Rs. ${formatter.format(absolute / 100)}`;
}

export function formatMoneyCell(cents: number): string {
  return TWO_DECIMAL_FORMAT.format(cents / 100);
}

export function formatCount(value: number): string {
  return WHOLE_NUMBER_FORMAT.format(value);
}
