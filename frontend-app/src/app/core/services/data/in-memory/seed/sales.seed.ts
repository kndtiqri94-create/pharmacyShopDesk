import { BestSeller, DailySalesPoint } from '../../../../models/domain/sales-summary.model';
import { addDays } from '../../../../utils/date.util';

export const SALES_SEED_END_DATE = '2026-09-21';
const SAMPLE_PROFIT_RATIO = 0.235;

type SalesRow = [salesCents: number, bills: number, profitCents?: number];

const SALES_ROWS: readonly SalesRow[] = [
  [5_870_000, 47],
  [6_120_000, 51],
  [6_480_000, 54],
  [5_940_000, 49],
  [7_310_000, 58],
  [8_050_000, 61],
  [7_220_000, 57],
  [5_380_000, 44],
  [6_890_000, 55],
  [7_040_000, 56],
  [6_330_000, 52],
  [6_760_000, 53],
  [8_210_000, 62],
  [7_480_000, 59],
  [5_620_000, 46],
  [6_950_000, 55],
  [7_110_000, 57],
  [6_470_000, 51],
  [6_820_000, 54],
  [8_440_000, 64],
  [7_690_000, 60],
  [5_710_000, 47],
  [7_495_000, 59],
  [6_200_000, 50],
  [7_100_000, 56],
  [6_800_000, 53],
  [9_650_000, 68],
  [8_800_000, 63],
  [5_950_000, 48],
  [8_425_000, 63, 1_984_000],
];

export const SALES_SEED: readonly DailySalesPoint[] = SALES_ROWS.map(
  ([salesCents, bills, profitCents], index) => ({
    date: addDays(SALES_SEED_END_DATE, index - (SALES_ROWS.length - 1)),
    salesCents,
    profitCents: profitCents ?? Math.round(salesCents * SAMPLE_PROFIT_RATIO),
    bills,
  })
);

export const BEST_SELLER_SEED: readonly BestSeller[] = [
  { productId: 'prod-001', productName: 'Paracetamol 500mg', unitsSold: 412 },
  { productId: 'prod-006', productName: 'ORS Sachet', unitsSold: 268 },
  { productId: 'prod-003', productName: 'Cetirizine 10mg', unitsSold: 190 },
  { productId: 'prod-004', productName: 'Omeprazole 20mg', unitsSold: 154 },
];
