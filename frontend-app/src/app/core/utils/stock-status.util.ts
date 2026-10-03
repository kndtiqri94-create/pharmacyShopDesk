import { ProductStatus } from '../models/enums/product-status.enum';
import { Product } from '../models/domain/product.model';
import { daysBetween } from './date.util';

export function getStockOnHand(product: Product): number {
  if (!product.trackBatches) return product.stockOnHand;
  return product.batches.reduce((total, batch) => total + batch.quantity, 0);
}

export function getNearestExpiry(product: Product): string | null {
  if (!product.trackBatches) return null;
  const dates = product.batches.filter(batch => batch.quantity > 0).map(batch => batch.expiryDate);
  dates.sort();
  return dates[0] ?? null;
}

export function getProductStatus(
  product: Product,
  expiryAlertDays: number,
  today: string
): ProductStatus {
  const stock = getStockOnHand(product);
  if (stock <= 0) return ProductStatus.OUT_OF_STOCK;
  if (stock <= product.reorderLevel) return ProductStatus.LOW_STOCK;
  const nearestExpiry = getNearestExpiry(product);
  if (nearestExpiry !== null && daysBetween(today, nearestExpiry) <= expiryAlertDays) {
    return ProductStatus.EXPIRING_SOON;
  }
  return ProductStatus.IN_STOCK;
}
