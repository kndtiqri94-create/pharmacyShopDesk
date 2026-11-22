export interface PayrollTaxSlab {
  upToCents: number | null;
  rate: number;
}

export interface PayrollSettings {
  epfEmployeeRate: number;
  epfEmployerRate: number;
  etfEmployerRate: number;
  taxSlabs: PayrollTaxSlab[];
  dailyRateDivisor: number;
  counters: string[];
  note: string;
}
