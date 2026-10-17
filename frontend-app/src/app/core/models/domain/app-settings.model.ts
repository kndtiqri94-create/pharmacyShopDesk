export interface AppSettings {
  shopName: string;
  branchLabel: string;
  registrationNo: string;
  address: string;
  phone: string;
  email: string;
  expiryAlertDays: number;
  defaultReorderLevel: number;
  lowFloatCents: number;
  showLowStockCountInSidebar: boolean;
  sellEarliestExpiringFirst: boolean;
  blockExpiredSales: boolean;
}
