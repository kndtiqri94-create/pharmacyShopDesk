export interface AppSettings {
  shopName: string;
  branchLabel: string;
  expiryAlertDays: number;
  defaultReorderLevel: number;
  lowFloatCents: number;
  showLowStockCountInSidebar: boolean;
  sellEarliestExpiringFirst: boolean;
  blockExpiredSales: boolean;
}
