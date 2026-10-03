import { AppSettings } from '../models/domain/app-settings.model';
import { Grn } from '../models/domain/grn.model';
import { Product } from '../models/domain/product.model';
import { GrnStatus } from '../models/enums/grn-status.enum';
import { ModuleKey } from '../models/enums/module-key.enum';
import { ProductStatus } from '../models/enums/product-status.enum';
import { getProductStatus } from './stock-status.util';

export type SidebarCounts = Partial<Record<ModuleKey, number>>;

const NEEDS_RESTOCK: readonly ProductStatus[] = [
  ProductStatus.LOW_STOCK,
  ProductStatus.OUT_OF_STOCK,
];

export function computeSidebarCounts(
  products: readonly Product[],
  grns: readonly Grn[],
  settings: AppSettings,
  today: string
): SidebarCounts {
  const counts: SidebarCounts = {};
  if (settings.showLowStockCountInSidebar) {
    counts[ModuleKey.PRODUCTS] = products.filter(product =>
      NEEDS_RESTOCK.includes(getProductStatus(product, settings.expiryAlertDays, today))
    ).length;
  }
  counts[ModuleKey.GRN] = grns.filter(grn => grn.status === GrnStatus.DRAFT).length;
  return counts;
}
