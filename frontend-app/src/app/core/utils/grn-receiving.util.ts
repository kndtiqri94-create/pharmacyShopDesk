import { Batch } from '../models/domain/batch.model';
import { GrnLine } from '../models/domain/grn-line.model';
import { Product } from '../models/domain/product.model';
import { PurchaseOrder } from '../models/domain/purchase-order.model';
import { PurchaseOrderLine } from '../models/domain/purchase-order-line.model';
import { PoStatus } from '../models/enums/po-status.enum';
import { sortBatchesByExpiry } from './batch-order.util';
import { nextRecordId } from './document-number.util';

const BATCH_ID_PREFIX = 'bat';
const OPEN_ORDER_STATUSES: readonly PoStatus[] = [PoStatus.SENT, PoStatus.PART_RECEIVED];

function addBatch(product: Product, line: GrnLine, batchIds: string[]): Product {
  const quantity = line.receivedQuantity + line.freeQuantity;
  const expiryDate = line.expiryDate ?? '';
  const batches: Batch[] = product.batches.map(batch => ({ ...batch }));
  const existing = batches.find(
    batch => batch.batchNo === line.batchNo && batch.expiryDate === expiryDate
  );
  if (existing) {
    existing.quantity += quantity;
    existing.costCents = line.costCents;
  } else {
    const id = nextRecordId(BATCH_ID_PREFIX, batchIds);
    batchIds.push(id);
    batches.push({
      id,
      batchNo: line.batchNo,
      expiryDate,
      quantity,
      costCents: line.costCents,
    });
  }
  return { ...product, batches: sortBatchesByExpiry(batches) };
}

function receiveLine(product: Product, line: GrnLine, batchIds: string[]): Product {
  const quantity = line.receivedQuantity + line.freeQuantity;
  const withStock = product.trackBatches
    ? addBatch(product, line, batchIds)
    : {
        ...product,
        batches: product.batches.map(batch => ({ ...batch })),
        stockOnHand: product.stockOnHand + quantity,
      };
  return { ...withStock, costCents: line.costCents };
}

export function applyGrnToProducts(
  lines: readonly GrnLine[],
  products: readonly Product[]
): Product[] {
  const batchIds = products.flatMap(product => product.batches.map(batch => batch.id));
  const changed = new Map<string, Product>();
  for (const line of lines) {
    const base = changed.get(line.productId) ?? products.find(item => item.id === line.productId);
    if (base) changed.set(line.productId, receiveLine(base, line, batchIds));
  }
  return Array.from(changed.values());
}

function nextOrderStatus(order: PurchaseOrder, orderLines: readonly PurchaseOrderLine[]): PoStatus {
  if (orderLines.every(line => line.receivedQuantity >= line.orderedQuantity)) {
    return PoStatus.RECEIVED;
  }
  return orderLines.some(line => line.receivedQuantity > 0) ? PoStatus.PART_RECEIVED : order.status;
}

export function applyGrnToOrder(lines: readonly GrnLine[], order: PurchaseOrder): PurchaseOrder {
  if (!OPEN_ORDER_STATUSES.includes(order.status)) return { ...order };
  const orderLines = order.lines.map(orderLine => ({
    ...orderLine,
    receivedQuantity:
      orderLine.receivedQuantity +
      lines
        .filter(line => line.productId === orderLine.productId)
        .reduce((total, line) => total + line.receivedQuantity, 0),
  }));
  return { ...order, lines: orderLines, status: nextOrderStatus(order, orderLines) };
}
