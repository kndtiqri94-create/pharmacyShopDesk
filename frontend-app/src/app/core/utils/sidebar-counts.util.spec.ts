import { ModuleKey } from '../models/enums/module-key.enum';
import { GRN_SEED } from '../services/data/in-memory/seed/grn.seed';
import { PRODUCT_SEED } from '../services/data/in-memory/seed/product.seed';
import { SETTINGS_SEED } from '../services/data/in-memory/seed/settings.seed';
import { computeSidebarCounts } from './sidebar-counts.util';

describe('sidebar-counts.util', () => {
  it('counts low and out-of-stock products and draft GRNs', () => {
    const counts = computeSidebarCounts(PRODUCT_SEED, GRN_SEED, SETTINGS_SEED, '2026-09-21');
    expect(counts[ModuleKey.PRODUCTS]).toBe(3);
    expect(counts[ModuleKey.GRN]).toBe(1);
  });

  it('leaves the product count out when the setting is off', () => {
    const counts = computeSidebarCounts(
      PRODUCT_SEED,
      GRN_SEED,
      { ...SETTINGS_SEED, showLowStockCountInSidebar: false },
      '2026-09-21'
    );
    expect(counts[ModuleKey.PRODUCTS]).toBeUndefined();
  });
});
