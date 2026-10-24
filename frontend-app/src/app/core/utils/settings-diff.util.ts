import { AppSettings } from '../models/domain/app-settings.model';
import { rupeesToCents } from './money.util';
import { toPosSettings } from './pos-settings.util';
import { SettingsDraft, ValidatedSettings } from './settings-validation.util';

export function toDraft(settings: AppSettings): SettingsDraft {
  const pos = toPosSettings(settings);
  return {
    shopName: settings.shopName,
    registrationNo: settings.registrationNo,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    expiryAlertDays: String(settings.expiryAlertDays),
    defaultReorderLevel: String(settings.defaultReorderLevel),
    lowFloatRupees: String(Math.round(settings.lowFloatCents / 100)),
    sellEarliestExpiringFirst: settings.sellEarliestExpiringFirst,
    blockExpiredSales: settings.blockExpiredSales,
    showLowStockCountInSidebar: settings.showLowStockCountInSidebar,
    posLineDiscountEnabled: pos.lineDiscountEnabled,
    posBillDiscountEnabled: pos.billDiscountEnabled,
    posDefaultDiscountPercent: String(pos.defaultDiscountPercent),
    posMaxDiscountPercent: String(pos.maxDiscountPercent),
    posHideSidebar: pos.hideSidebarOnOpen,
  };
}

export function fromDraft(values: ValidatedSettings, saved: AppSettings): AppSettings {
  return {
    ...saved,
    shopName: values.shopName,
    registrationNo: values.registrationNo,
    address: values.address,
    phone: values.phone,
    email: values.email,
    expiryAlertDays: values.expiryAlertDays,
    defaultReorderLevel: values.defaultReorderLevel,
    lowFloatCents: rupeesToCents(values.lowFloatRupees),
    sellEarliestExpiringFirst: values.sellEarliestExpiringFirst,
    blockExpiredSales: values.blockExpiredSales,
    showLowStockCountInSidebar: values.showLowStockCountInSidebar,
    posLineDiscountEnabled: values.posLineDiscountEnabled,
    posBillDiscountEnabled: values.posBillDiscountEnabled,
    posDefaultDiscountPercent: values.posDefaultDiscountPercent,
    posMaxDiscountPercent: values.posMaxDiscountPercent,
    posHideSidebar: values.posHideSidebar,
  };
}

export function isSettingsDirty(draft: SettingsDraft, saved: AppSettings): boolean {
  const original = toDraft(saved);
  return (Object.keys(original) as (keyof SettingsDraft)[]).some(
    key => draft[key] !== original[key]
  );
}
