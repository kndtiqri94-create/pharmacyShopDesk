import { Product } from '../models/domain/product.model';
import { ProductSyncRecord, ProductSyncServerRecord } from '../models/domain/product-sync.model';
import { applyProductUpdate } from './pos-product-update.util';
import { getStockOnHand } from './stock-status.util';

export interface ProductSyncBaseline {
  lastSyncedStock: number;
  opSeq: number;
}

export function productMatchKey(product: Product): string {
  const barcode = product.barcode.trim();
  return barcode === '' ? product.sku.trim() : barcode;
}

export function hasUnusableMatchKeys(products: readonly Product[]): boolean {
  const seen = new Set<string>();
  for (const product of products) {
    const key = productMatchKey(product);
    if (key === '' || seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

export function computeStockDelta(currentStock: number, baseline: number | undefined): number {
  return baseline === undefined ? 0 : currentStock - baseline;
}

export function buildSyncRecord(
  product: Product,
  baseline: ProductSyncBaseline | undefined
): ProductSyncRecord {
  const matchKey = productMatchKey(product);
  const stock = getStockOnHand(product);
  return {
    matchKey,
    name: product.name,
    category: product.category,
    unit: product.unit,
    priceCents: product.priceCents,
    costCents: product.costCents,
    stockOnHand: stock,
    active: product.active,
    stockDelta: computeStockDelta(stock, baseline?.lastSyncedStock),
    operationId: `${matchKey}:${baseline?.opSeq ?? 0}`,
  };
}

export function applyServerRecord(
  product: Product,
  server: ProductSyncServerRecord,
  sentStock: number,
  today: string
): Product {
  const soldSinceSent = getStockOnHand(product) - sentStock;
  const stock = Math.max(0, server.stockOnHand + soldSinceSent);
  const withServerDetails: Product = {
    ...product,
    name: server.name,
    category: server.category,
    unit: server.unit,
    costCents: server.costCents,
    active: server.active,
  };
  return applyProductUpdate(withServerDetails, { priceCents: server.priceCents, stock }, today);
}

export function createProductFromServer(server: ProductSyncServerRecord): Product {
  return {
    id: '',
    name: server.name,
    genericName: server.name,
    category: server.category,
    form: '',
    unit: server.unit,
    sku: server.matchKey,
    barcode: server.matchKey,
    manufacturer: '',
    costCents: server.costCents,
    priceCents: server.priceCents,
    reorderLevel: 0,
    trackBatches: false,
    stockOnHand: server.stockOnHand,
    prescriptionRequired: false,
    active: server.active,
    taxRatePercent: 0,
    shelfLocation: '',
    showInPosQuickList: false,
    batches: [],
  };
}
