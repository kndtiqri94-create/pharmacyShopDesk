export interface DailySalesPoint {
  date: string;
  salesCents: number;
  profitCents: number;
  bills: number;
}

export interface TodaySalesSummary {
  date: string;
  salesCents: number;
  profitCents: number;
  bills: number;
  comparedSalesCents: number;
}

export interface BestSeller {
  productId: string;
  productName: string;
  unitsSold: number;
}
