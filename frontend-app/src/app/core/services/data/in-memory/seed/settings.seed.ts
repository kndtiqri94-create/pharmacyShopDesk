import { AppSettings } from '../../../../models/domain/app-settings.model';

export const SETTINGS_SEED: AppSettings = {
  shopName: 'ShopDesk',
  branchLabel: 'Main Shop',
  registrationNo: 'PV 00012345',
  address: '42 Galle Road, Colombo 03',
  phone: '011 234 5678',
  email: 'hello@shopdesk.example',
  expiryAlertDays: 60,
  defaultReorderLevel: 20,
  lowFloatCents: 1_000_000,
  showLowStockCountInSidebar: true,
  sellEarliestExpiringFirst: true,
  blockExpiredSales: true,
};
