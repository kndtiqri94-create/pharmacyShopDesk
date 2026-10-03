import { AppSettings } from '../../../../models/domain/app-settings.model';

export const SETTINGS_SEED: AppSettings = {
  shopName: 'ShopDesk',
  branchLabel: 'Main Shop',
  expiryAlertDays: 60,
  defaultReorderLevel: 20,
  lowFloatCents: 1_000_000,
  showLowStockCountInSidebar: true,
  sellEarliestExpiringFirst: true,
  blockExpiredSales: true,
};
