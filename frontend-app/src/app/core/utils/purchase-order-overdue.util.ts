import { PoStatus } from '../models/enums/po-status.enum';
import { PurchaseOrder } from '../models/domain/purchase-order.model';
import { daysBetween } from './date.util';

const OPEN_STATUSES: readonly PoStatus[] = [PoStatus.SENT, PoStatus.PART_RECEIVED];

export function isPurchaseOrderOverdue(order: PurchaseOrder, today: string): boolean {
  return OPEN_STATUSES.includes(order.status) && daysBetween(order.expectedDate, today) > 0;
}
