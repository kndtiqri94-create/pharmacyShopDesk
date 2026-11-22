import { AppSettings } from '../models/domain/app-settings.model';
import { PosSettings } from '../models/domain/pos-settings.model';

export const POS_SETTINGS_DEFAULTS: PosSettings = {
  lineDiscountEnabled: true,
  billDiscountEnabled: true,
  defaultDiscountPercent: 0,
  maxDiscountPercent: 20,
  hideSidebarOnOpen: true,
};

function validPercent(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : fallback;
}

export function toPosSettings(settings: Partial<AppSettings> | null | undefined): PosSettings {
  const defaults = POS_SETTINGS_DEFAULTS;
  const source = settings ?? {};
  const maxPercent = validPercent(source.posMaxDiscountPercent, defaults.maxDiscountPercent);
  const defaultPercent = validPercent(
    source.posDefaultDiscountPercent,
    defaults.defaultDiscountPercent
  );
  return {
    lineDiscountEnabled: source.posLineDiscountEnabled ?? defaults.lineDiscountEnabled,
    billDiscountEnabled: source.posBillDiscountEnabled ?? defaults.billDiscountEnabled,
    defaultDiscountPercent: Math.min(defaultPercent, maxPercent),
    maxDiscountPercent: maxPercent,
    hideSidebarOnOpen: source.posHideSidebar ?? defaults.hideSidebarOnOpen,
  };
}
