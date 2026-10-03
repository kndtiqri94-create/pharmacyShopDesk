export type MarginKind = 'none' | 'loss' | 'profit';

export interface MarginResult {
  kind: MarginKind;
  percent: number;
  profitCents: number;
}

const NO_MARGIN: MarginResult = { kind: 'none', percent: 0, profitCents: 0 };

export function computeMargin(costCents: number, priceCents: number): MarginResult {
  const valid = [costCents, priceCents].every(value => Number.isFinite(value));
  if (!valid || costCents <= 0 || priceCents <= 0) return NO_MARGIN;
  const profitCents = priceCents - costCents;
  const percent = Math.round((profitCents / priceCents) * 1000) / 10;
  return { kind: profitCents < 0 ? 'loss' : 'profit', percent, profitCents };
}
