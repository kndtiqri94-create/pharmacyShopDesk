const NUMBER_DIGITS = 4;
const ID_DIGITS = 3;

function highestSuffix(values: readonly string[], prefix: string): number {
  return values
    .filter(value => value.startsWith(prefix))
    .map(value => Number(value.slice(prefix.length)))
    .filter(Number.isInteger)
    .reduce((highest, value) => Math.max(highest, value), 0);
}

export function nextDocumentNumber(prefix: 'GRN' | 'PO', existing: readonly string[]): string {
  const next = highestSuffix(existing, `${prefix}-`) + 1;
  return `${prefix}-${String(next).padStart(NUMBER_DIGITS, '0')}`;
}

export function nextRecordId(prefix: string, existing: readonly string[]): string {
  const next = highestSuffix(existing, `${prefix}-`) + 1;
  return `${prefix}-${String(next).padStart(ID_DIGITS, '0')}`;
}
