import { Product } from '../models/domain/product.model';
import { getStockOnHand } from './stock-status.util';

export const LOW_STOCK_TARGET_FACTOR = 2;

export interface PurchaseOrderLineAmounts {
  quantity: number;
  unitCostCents: number;
}

export interface PurchaseOrderTotals {
  lineCount: number;
  unitCount: number;
  subTotalCents: number;
  deliveryCents: number;
  totalCents: number;
}

export interface LowStockSuggestion {
  productId: string;
  quantity: number;
}

export function purchaseOrderLineTotalCents(line: PurchaseOrderLineAmounts): number {
  return line.quantity * line.unitCostCents;
}

export function computePurchaseOrderTotals(
  lines: readonly PurchaseOrderLineAmounts[],
  deliveryCents: number
): PurchaseOrderTotals {
  const subTotalCents = lines.reduce((sum, line) => sum + purchaseOrderLineTotalCents(line), 0);
  return {
    lineCount: lines.length,
    unitCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subTotalCents,
    deliveryCents,
    totalCents: subTotalCents + deliveryCents,
  };
}

export function isLowStock(product: Product): boolean {
  return getStockOnHand(product) <= product.reorderLevel;
}

export function suggestOrderQuantity(product: Product): number {
  const target = product.reorderLevel * LOW_STOCK_TARGET_FACTOR;
  return Math.max(1, target - getStockOnHand(product));
}

export function suggestLowStockLines(
  products: readonly Product[],
  existingProductIds: readonly string[]
): LowStockSuggestion[] {
  return products
    .filter(
      product => product.active && isLowStock(product) && !existingProductIds.includes(product.id)
    )
    .map(product => ({ productId: product.id, quantity: suggestOrderQuantity(product) }));
}
